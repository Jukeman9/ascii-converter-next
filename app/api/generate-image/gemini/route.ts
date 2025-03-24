import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, apiKey } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt }
            ]
          }],
          generationConfig: {
            responseModalities: ["Text", "Image"]
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to generate image with Gemini' },
        { status: response.status }
      );
    }

    const data = await response.json();
    const imageData = data.candidates[0].content.parts.find((part: { inlineData?: { data: string } }) => part.inlineData)?.inlineData.data;

    if (!imageData) {
      return NextResponse.json({ error: 'No image data in response' }, { status: 500 });
    }

    return NextResponse.json({ imageData });
  } catch (error: unknown) {
    console.error('Error generating image with Gemini:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate image' },
      { status: 500 }
    );
  }
} 