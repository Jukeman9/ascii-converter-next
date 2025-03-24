import { NextRequest, NextResponse } from 'next/server';

// Read API key from environment variable
const API_KEY = process.env.GETIMG_API_KEY;

export async function GET() {
  try {
    if (!API_KEY) {
      return NextResponse.json({ error: 'GetImg API key is not configured' }, { status: 500 });
    }

    const response = await fetch('https://api.getimg.ai/v1/models', {
      headers: {
        'accept': 'application/json',
        'authorization': `Bearer ${API_KEY}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.message || 'Failed to fetch models' },
        { status: response.status }
      );
    }

    const models = await response.json();

    // Filter models to only include text-to-image capable ones
    const filteredModels = models.filter((model: any) => 
      model.pipelines.includes('text-to-image') && 
      (model.family === 'stable-diffusion' || 
       model.family === 'stable-diffusion-xl' || 
       model.family === 'latent-consistency')
    );

    return NextResponse.json(filteredModels);
  } catch (error: any) {
    console.error('Error fetching models:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch models' },
      { status: 500 }
    );
  }
} 