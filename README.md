# HTTP Server for DAIN Agent

This is a simple HTTP server that provides endpoints for the DAIN agent in the `specnote` project to interact with.

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file (or use the existing one) with the following variables:
   ```
   PORT=8080
   NODE_ENV=development
   ```

## Running the Server

Start the server in development mode:
```
npm run dev
```

For production:
```
npm start
```

## API Endpoints

### Health Check
```
GET /health
```
Returns the status of the server.

### Image Endpoints
```
GET /images/{filename}
```
Serves static image files directly from the server's images folder.

```
GET /api/images
```
Returns a list of all available images with their URLs and metadata.

```
GET /api/images/{filename}
```
Returns metadata for a specific image.

### Weather Data
```
GET /api/weather?latitude=35.6762&longitude=139.6503&locationName=Tokyo
```
Returns mock weather data for the specified location.

### Weather Forecast
```
GET /api/forecast?latitude=35.6762&longitude=139.6503&locationName=Tokyo
```
Returns mock 24-hour forecast data for the specified location.

### Data Storage
```
POST /api/data
Body: { "key": "someKey", "value": "someValue" }
```
Stores a key-value pair in the server's memory.

```
GET /api/data/:key
```
Retrieves the value for the specified key.

## Integration with DAIN Agent

### Using the Image Card Component with Server Images

To display an image from the server in the DAIN agent, update your DAIN tool handler to use the ImageCardUIBuilder component:

```typescript
import { ImageCardUIBuilder, DainResponse } from "@dainprotocol/utils";

// Example tool handler to display an image from the server
const getImageConfig = {
  id: "get-image",
  name: "Get Image",
  description: "Displays an image from the server",
  input: z.object({
    imageName: z.string().describe("Name of the image to display")
  }),
  output: z.object({
    imageUrl: z.string().describe("URL of the displayed image")
  }),
  handler: async ({ imageName }, agentInfo, context) => {
    // Get the image URL from the server
    const serverUrl = "http://localhost:8080"; // Update with your server URL
    const imageUrl = `${serverUrl}/images/${encodeURIComponent(imageName)}`;
    
    // Create an image card UI
    const imageCard = new ImageCardUIBuilder({ imageUrl })
      .title(`Image: ${imageName}`)
      .description("Image from the server")
      .aspectRatio("wide")
      .withOverlay(true)
      .build();
    
    return new DainResponse({
      text: `Displaying image: ${imageName}`,
      data: { imageUrl },
      ui: imageCard
    });
  }
};
```

### Fetching Available Images

You can also create a tool to fetch and display all available images:

```typescript
const listImagesConfig = {
  id: "list-images",
  name: "List Available Images",
  description: "Lists all available images from the server",
  input: z.object({}),
  output: z.object({
    images: z.array(z.object({
      filename: z.string(),
      url: z.string()
    }))
  }),
  handler: async ({}, agentInfo, context) => {
    const serverUrl = "http://localhost:8080"; // Update with your server URL
    
    // Fetch available images from the server
    const response = await axios.get(`${serverUrl}/api/images`);
    const { images } = response.data;
    
    // Create a layout with image cards for each image
    const layout = new LayoutUIBuilder()
      .setRenderMode("page")
      .setLayoutType("grid")
      .title("Available Images")
      .addChildren(
        images.map(image => 
          new ImageCardUIBuilder({ imageUrl: image.url })
            .title(image.filename)
            .aspectRatio("square")
            .build()
        )
      )
      .build();
    
    return new DainResponse({
      text: `Found ${images.length} images on the server.`,
      data: { images },
      ui: layout
    });
  }
};
``` 