import { NextRequest, NextResponse } from 'next/server';

// Read API key from environment variable
const API_KEY = process.env.GETIMG_API_KEY;

interface RequestBody {
  model: string;
  prompt: string;
  negative_prompt?: string;
  width: number;
  height: number;
  response_format: string;
  [key: string]: any; // Add index signature to allow string indexing
}

export async function POST(request: NextRequest) {
  try {
    if (!API_KEY) {
      return NextResponse.json({ error: 'GetImg API key is not configured' }, { status: 500 });
    }

    const { prompt, negative_prompt, model } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!model) {
      return NextResponse.json({ error: 'Model is required' }, { status: 400 });
    }

    // Determine the API endpoint based on the model family
    let endpoint;
    const modelId = String(model).split(':')[0]; // Extract model ID if it has format "id:family"
    const modelFamily = String(model).split(':')[1] || 'stable-diffusion-xl'; // Default to SDXL if not specified

    // Use the family to determine the endpoint
    endpoint = `https://api.getimg.ai/v1/${modelFamily}/text-to-image`;

    // Build request body
    const requestBody: RequestBody = {
      model: modelId,
      prompt,
      negative_prompt: negative_prompt || undefined,
      width: 1024,
      height: 1024,
      response_format: 'b64'
    };

    // Remove undefined values
    Object.keys(requestBody).forEach(key => 
      requestBody[key] === undefined && delete requestBody[key]
    );

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || 'Failed to generate image with GetImg' },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({ imageData: data.image });
  } catch (error: any) {
    console.error('Error generating image with GetImg:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate image' },
      { status: 500 }
    );
  }
} 