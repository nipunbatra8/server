require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const { OpenAI } = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the images directory
app.use('/images', express.static(path.join(__dirname, 'images')));

// Simple health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Get available images
app.get('/api/images', (req, res) => {
  const imagesDir = path.join(__dirname, 'images');
  
  fs.readdir(imagesDir, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to read images directory', details: err.message });
    }
    
    // Filter for image files only
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext);
    });
    
    // Get details for each image
    const images = imageFiles.map(file => {
      try {
        const stats = fs.statSync(path.join(imagesDir, file));
        return {
          filename: file,
          url: `${req.protocol}://${req.get('host')}/images/${encodeURIComponent(file)}`,
          size: stats.size,
          lastModified: stats.mtime
        };
      } catch (error) {
        return {
          filename: file,
          url: `${req.protocol}://${req.get('host')}/images/${encodeURIComponent(file)}`,
          error: 'Could not get file stats'
        };
      }
    });
    
    res.status(200).json({ images });
  });
});

// Get specific image info
app.get('/api/images/:filename', (req, res) => {
  const { filename } = req.params;
  const imagePath = path.join(__dirname, 'images', filename);
  
  fs.stat(imagePath, (err, stats) => {
    if (err) {
      return res.status(404).json({ error: 'Image not found', details: err.message });
    }
    
    const imageInfo = {
      filename,
      url: `${req.protocol}://${req.get('host')}/images/${encodeURIComponent(filename)}`,
      size: stats.size,
      lastModified: stats.mtime,
      type: path.extname(filename).toLowerCase().substring(1)
    };
    
    res.status(200).json(imageInfo);
  });
});

// Dedicated endpoint for DAIN agent to display images
app.get('/api/dain/image', (req, res) => {
  const { filename, aspectRatio = 'wide', title, description } = req.query;
  
  if (!filename) {
    return res.status(400).json({ 
      error: 'Missing required parameter: filename' 
    });
  }
  
  const imagePath = path.join(__dirname, 'images', filename);
  
  // Check if the image exists
  fs.access(imagePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json({ 
        error: 'Image not found',
        details: `${filename} does not exist in the images directory`
      });
    }
    
    // Generate a response formatted for easy use with DAIN's ImageCardUIBuilder
    const imageUrl = `${req.protocol}://${req.get('host')}/images/${encodeURIComponent(filename)}`;
    
    const response = {
      success: true,
      image: {
        url: imageUrl,
        filename,
        title: title || filename,
        description: description || 'Image from server',
        aspectRatio: aspectRatio || 'wide',
        fullPath: imagePath
      },
      usage: {
        dainExample: `
        const imageCard = new ImageCardUIBuilder({ imageUrl: "${imageUrl}" })
          .title("${title || filename}")
          .description("${description || 'Image from server'}")
          .aspectRatio("${aspectRatio || 'wide'}")
          .build();
        `
      }
    };
    
    res.status(200).json(response);
  });
});

// Sample weather data endpoint that the DAIN agent can use
app.get('/api/weather', (req, res) => {
  const { latitude, longitude, locationName } = req.query;
  
  // Validate required parameters
  if (!latitude || !longitude || !locationName) {
    return res.status(400).json({ 
      error: 'Missing required parameters. Please provide latitude, longitude, and locationName.' 
    });
  }

  // Mock weather data - in a real app, you would call a weather API
  const mockWeatherData = {
    temperature: parseFloat((Math.random() * 30).toFixed(1)),
    windSpeed: parseFloat((Math.random() * 20).toFixed(1)),
    humidity: parseFloat((Math.random() * 100).toFixed(1)),
    locationName: locationName,
    coordinates: {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    },
    timestamp: new Date().toISOString()
  };

  res.status(200).json(mockWeatherData);
});

// Sample forecast endpoint
app.get('/api/forecast', (req, res) => {
  const { latitude, longitude, locationName } = req.query;
  
  // Validate required parameters
  if (!latitude || !longitude || !locationName) {
    return res.status(400).json({ 
      error: 'Missing required parameters. Please provide latitude, longitude, and locationName.' 
    });
  }

  // Generate mock forecast data
  const hours = 24;
  const forecast = {
    locationName,
    coordinates: {
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude)
    },
    forecasts: []
  };

  const currentDate = new Date();
  for (let i = 0; i < hours; i++) {
    const forecastDate = new Date(currentDate);
    forecastDate.setHours(currentDate.getHours() + i);
    
    forecast.forecasts.push({
      time: forecastDate.toISOString(),
      temperature: parseFloat((Math.random() * 30).toFixed(1)),
      windSpeed: parseFloat((Math.random() * 20).toFixed(1)),
      humidity: parseFloat((Math.random() * 100).toFixed(1))
    });
  }

  res.status(200).json(forecast);
});

// Generic data storage endpoint example
const dataStore = {};

// New endpoint to log POST requests
app.post('/api/log-post', (req, res) => {
  console.log('POST request received:');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  res.status(200).json({ 
    message: 'Request logged successfully',
    receivedData: {
      headers: req.headers,
      body: req.body
    }
  });
});

app.post('/api/data', (req, res) => {
  const { key, value } = req.body;
  
  // Log all POST requests to this endpoint
  console.log('POST to /api/data:', { key, value, fullBody: req.body });
  
  if (!key || value === undefined) {
    return res.status(400).json({ error: 'Both key and value are required' });
  }
  
  dataStore[key] = value;
  res.status(201).json({ message: 'Data stored successfully', key, value });
});

app.get('/api/data/:key', (req, res) => {
  const { key } = req.params;
  
  if (dataStore[key] === undefined) {
    return res.status(404).json({ error: `No data found for key: ${key}` });
  }
  
  res.status(200).json({ key, value: dataStore[key] });
});

// Generic handler for POST requests to the root path
app.post('/', (req, res) => {
  console.log('POST request received at root path:');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  res.status(200).json({ 
    message: 'Root POST request received',
    receivedData: {
      headers: req.headers,
      body: req.body
    }
  });
});

// Handle base64 image data and display it
app.post('/api/display-image', (req, res) => {
  const { width, height, data } = req.body;
  
  console.log('Received image data:');
  console.log('Width:', width);
  console.log('Height:', height);
  console.log('Base64 data length:', data ? data.length : 0);
  
  if (!data) {
    return res.status(400).json({ error: 'Missing required parameter: data (base64 image)' });
  }
  
  // Generate a unique ID for this image
  const imageId = Date.now().toString();
  
  // Store the image data temporarily
  dataStore[`image_${imageId}`] = {
    width: width || 'auto',
    height: height || 'auto',
    data,
    timestamp: new Date().toISOString()
  };
  
  // Redirect to the HTML page that will display the image
  res.status(200).json({ 
    success: true, 
    imageId,
    viewUrl: `${req.protocol}://${req.get('host')}/view-image.html?id=${imageId}`
  });
});

// API endpoint to get the stored image data
app.get('/api/image/:id', (req, res) => {
  const { id } = req.params;
  const imageData = dataStore[`image_${id}`];
  
  if (!imageData) {
    return res.status(404).json({ error: 'Image not found' });
  }
  
  res.status(200).json(imageData);
});

// API endpoint to get all stored images for the gallery
app.get('/api/gallery', (req, res) => {
  const images = [];
  
  // Find all keys in dataStore that start with "image_"
  Object.keys(dataStore).forEach(key => {
    if (key.startsWith('image_')) {
      const id = key.replace('image_', '');
      const imageData = dataStore[key];
      
      images.push({
        id,
        width: imageData.width,
        height: imageData.height,
        data: imageData.data,
        timestamp: imageData.timestamp
      });
    }
  });
  
  // Sort images by timestamp (newest first)
  images.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  res.status(200).json({ images });
});

// Add a more robust endpoint for handling base64 images with detailed debugging
app.post('/api/debug-image', (req, res) => {
  let rawData = '';
  
  req.on('data', chunk => {
    rawData += chunk.toString();
  });
  
  req.on('end', () => {
    console.log('DEBUG - Raw data received, length:', rawData.length);
    console.log('DEBUG - First 100 chars:', rawData.substring(0, 100));
    
    if (!rawData || rawData.length === 0) {
      return res.status(400).json({ error: 'Missing image data' });
    }
    
    // Try to detect the format of the data
    let imageData = rawData;
    let detectedFormat = 'unknown';
    
    // Check if it's a data URL
    if (rawData.startsWith('data:')) {
      detectedFormat = 'data-url';
      console.log('DEBUG - Detected data URL format');
      // Already in the right format, no need to modify
    } 
    // Check if it's just base64 without the prefix
    else if (/^[A-Za-z0-9+/=]+$/.test(rawData.substring(0, 100))) {
      detectedFormat = 'base64-only';
      console.log('DEBUG - Detected raw base64 format');
      // Add the data URL prefix
      imageData = `data:image/png;base64,${rawData}`;
    }
    // It might be JSON or something else
    else {
      try {
        const jsonData = JSON.parse(rawData);
        detectedFormat = 'json';
        console.log('DEBUG - Detected JSON format:', jsonData);
        
        // Try to extract base64 data from JSON
        if (jsonData.data && typeof jsonData.data === 'string') {
          if (jsonData.data.startsWith('data:')) {
            imageData = jsonData.data;
          } else {
            imageData = `data:image/png;base64,${jsonData.data}`;
          }
        } else {
          return res.status(400).json({ 
            error: 'Could not find base64 data in JSON',
            receivedJson: jsonData
          });
        }
      } catch (e) {
        console.log('DEBUG - Not valid JSON, treating as raw data');
        // Not JSON, just use as is and hope for the best
        imageData = `data:image/png;base64,${rawData}`;
      }
    }
    
    // Generate a unique ID for this image
    const imageId = Date.now().toString();
    
    // Store the image data
    dataStore[`image_${imageId}`] = {
      width: 'auto',
      height: 'auto',
      data: imageData,
      timestamp: new Date().toISOString(),
      detectedFormat
    };
    
    // Return detailed debug info
    res.status(200).json({ 
      success: true, 
      imageId,
      detectedFormat,
      dataLength: rawData.length,
      viewUrl: `${req.protocol}://${req.get('host')}/view-image.html?id=${imageId}`,
      debugInfo: {
        firstChars: rawData.substring(0, 50) + '...',
        storedDataFirstChars: imageData.substring(0, 50) + '...'
      }
    });
  });
});

// Add OpenAI integration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Add a new endpoint that analyzes images with OpenAI Vision
app.post('/api/analyze-image', async (req, res) => {
  let rawData = '';
  
  req.on('data', chunk => {
    rawData += chunk.toString();
  });
  
  req.on('end', async () => {
    console.log('Received data for analysis, length:', rawData.length);
    
    if (!rawData || rawData.length === 0) {
      return res.status(400).json({ error: 'Missing image data' });
    }
    
    // Process the image data to ensure it's in the right format
    let imageData = rawData;
    let detectedFormat = 'unknown';
    
    // Check if it's a data URL
    if (rawData.startsWith('data:')) {
      detectedFormat = 'data-url';
      // Already in the right format
    } 
    // Check if it's just base64 without the prefix
    else if (/^[A-Za-z0-9+/=]+$/.test(rawData.substring(0, 100))) {
      detectedFormat = 'base64-only';
      imageData = `data:image/png;base64,${rawData}`;
    }
    // It might be JSON
    else {
      try {
        const jsonData = JSON.parse(rawData);
        detectedFormat = 'json';
        
        if (jsonData.data && typeof jsonData.data === 'string') {
          if (jsonData.data.startsWith('data:')) {
            imageData = jsonData.data;
          } else {
            imageData = `data:image/png;base64,${jsonData.data}`;
          }
        } else {
          return res.status(400).json({ 
            error: 'Could not find base64 data in JSON',
            receivedJson: jsonData
          });
        }
      } catch (e) {
        // Not JSON, just use as is
        imageData = `data:image/png;base64,${rawData}`;
      }
    }
    
    // Generate a unique ID for this image
    const imageId = Date.now().toString();
    
    try {
      // Call OpenAI API for image analysis
      console.log('Calling OpenAI API for image analysis...');
      
      const response = await openai.chat.completions.create({
        model: "gpt-4.1-2025-04-14",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "What's in this image? Provide a detailed description." },
              { type: "image_url", image_url: { url: imageData } }
            ],
          },
        ],
        // max_tokens: 300,
      });
      
      // Extract the analysis text
      const analysisText = response.choices[0]?.message?.content || 'No analysis available';
      console.log('Analysis received:', analysisText);
      
      // Store the image data with the analysis
      dataStore[`image_${imageId}`] = {
        width: 'auto',
        height: 'auto',
        data: imageData,
        timestamp: new Date().toISOString(),
        analysis: analysisText,
        detectedFormat
      };
      
      // Return the image info with analysis
      res.status(200).json({ 
        success: true, 
        imageId,
        analysis: analysisText,
        viewUrl: `${req.protocol}://${req.get('host')}/view-image.html?id=${imageId}`
      });
      
    } catch (error) {
      console.error('Error analyzing image with OpenAI:', error);
      
      // Store the image data without analysis
      dataStore[`image_${imageId}`] = {
        width: 'auto',
        height: 'auto',
        data: imageData,
        timestamp: new Date().toISOString(),
        analysis: `Error analyzing image: ${error.message}`,
        detectedFormat
      };
      
      // Return error but still provide the image URL
      res.status(200).json({ 
        success: true,
        imageId,
        error: `Error analyzing image: ${error.message}`,
        viewUrl: `${req.protocol}://${req.get('host')}/view-image.html?id=${imageId}`
      });
    }
  });
});

// Add a new endpoint that returns a random text summary and image links
app.get('/api/get-summary', (req, res) => {
  // Array of possible random summaries
  const summaries = [
    "A collection of small images perfect for web design projects. These compact visuals can be used for icons, thumbnails, or decorative elements on your website.",
    "Explore our curated selection of small-sized images. Ideal for projects where file size matters but quality is still important.",
    "Minimalist images that pack a visual punch despite their small dimensions. Great for mobile-first design approaches.",
    "A variety of small PNG and JPEG images that load quickly and efficiently. Perfect for optimizing website performance.",
    "Compact visuals for your next creative project. These small images are versatile and can be used across multiple platforms."
  ];
  
  // Image links from the provided URLs
  const imageLinks = [
    "https://png.pngtree.com/png-vector/20191121/ourmid/pngtree-blue-bird-vector-or-color-illustration-png-image_2013004.jpg",
    "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQCYM8ihwZPidLr5bL8MMlmHSj2KzDnp_vfDw&s"
  ];
  
  // Select a random summary
  const randomSummary = summaries[Math.floor(Math.random() * summaries.length)];
  
  // Return the summary and image links
  res.status(200).json({
    success: true,
    summary: randomSummary,
    imageLinks: imageLinks,
    timestamp: new Date().toISOString()
  });
});

// Add an endpoint to store text and display it
app.put('/api/put-voice', (req, res) => {
  let rawData = '';
  
  req.on('data', chunk => {
    rawData += chunk.toString();
  });
  
  req.on('end', () => {
    console.log('Received text data, length:', rawData.length);
    
    if (!rawData || rawData.length === 0) {
      return res.status(400).json({ error: 'Missing text data' });
    }
    
    // Try to parse as JSON if it looks like JSON
    let textContent = rawData;
    let textTitle = 'Text Display';
    
    try {
      if (rawData.trim().startsWith('{')) {
        const jsonData = JSON.parse(rawData);
        if (jsonData.text) {
          textContent = jsonData.text;
        }
        if (jsonData.title) {
          textTitle = jsonData.title;
        }
      }
    } catch (e) {
      // Not valid JSON, use as plain text
      console.log('Not valid JSON, using as plain text');
    }
    
    // Generate a unique ID for this text
    const textId = Date.now().toString();
    
    // Store the text data
    dataStore[`text_${textId}`] = {
      content: textContent,
      title: textTitle,
      timestamp: new Date().toISOString()
    };
    
    // Return the text info
    res.status(200).json({ 
      success: true, 
      textId,
      viewUrl: `${req.protocol}://${req.get('host')}/display-text.html?id=${textId}`
    });
  });
});

// API endpoint to get the stored text data
app.get('/api/text/:id', (req, res) => {
  const { id } = req.params;
  const textData = dataStore[`text_${id}`];
  
  if (!textData) {
    return res.status(404).json({ error: 'Text not found' });
  }
  
  res.status(200).json(textData);
});

// Add endpoint to get all stored texts
app.get('/api/texts', (req, res) => {
  const texts = [];
  
  // Extract all text entries from the dataStore
  Object.keys(dataStore).forEach(key => {
    if (key.startsWith('text_')) {
      const id = key.replace('text_', '');
      texts.push({
        id,
        content: dataStore[key].content,
        timestamp: dataStore[key].timestamp
      });
    }
  });
  
  res.status(200).json({ texts });
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Images API: http://localhost:${PORT}/api/images`);
  console.log(`Text API: http://localhost:${PORT}/api/get-text`);
  console.log(`Text Input Form: http://localhost:${PORT}/text-input.html`);
  console.log(`DAIN Image API: http://localhost:${PORT}/api/dain/image?filename=example.png`);
  console.log(`Base64 Image API: http://localhost:${PORT}/api/base64-image`);
  console.log(`Static images: http://localhost:${PORT}/images/[filename]`);
  console.log(`Image Gallery: http://localhost:${PORT}/gallery.html`);
}); 