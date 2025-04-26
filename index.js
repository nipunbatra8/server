require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

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

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Images API: http://localhost:${PORT}/api/images`);
  console.log(`DAIN Image API: http://localhost:${PORT}/api/dain/image?filename=example.png`);
  console.log(`Static images: http://localhost:${PORT}/images/[filename]`);
}); 