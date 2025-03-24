'use client';

import { useState, useEffect } from 'react';

type ImageGeneratorProps = {
  onImageGenerated: (imageUrl: string) => void;
};

export default function ImageGenerator({ onImageGenerated }: ImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [generatingGemini, setGeneratingGemini] = useState(false);
  const [generatingGetImg, setGeneratingGetImg] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generationTime, setGenerationTime] = useState<number | null>(null);
  const [models, setModels] = useState<any[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [currentGenerator, setCurrentGenerator] = useState<'gemini' | 'getimg' | null>(null);

  // Fetch available models from GetImg API
  useEffect(() => {
    async function fetchModels() {
      try {
        const response = await fetch('/api/models');
        
        if (!response.ok) {
          throw new Error('Failed to fetch models');
        }
        
        const data = await response.json();
        setModels(data);
        
        // Set default model if available
        if (data.length > 0) {
          const defaultModel = data.find((m: any) => m.id === 'juggernaut-xl') || data[0];
          setSelectedModel(`${defaultModel.id}:${defaultModel.family}`);
        }
      } catch (error) {
        console.error('Error fetching models:', error);
        setError('Failed to fetch models. GetImg integration may not be available.');
      }
    }
    
    fetchModels();
  }, []);

  // Generate image with Gemini
  const generateGeminiImage = async () => {
    if (!prompt) {
      setError('Please enter a description');
      return;
    }

    if (!geminiApiKey) {
      setError('Please enter your Gemini API key');
      return;
    }
    
    setError(null);
    setGeneratingGemini(true);
    setCurrentGenerator('gemini');
    const startTime = performance.now();
    
    try {
      const response = await fetch('/api/generate-image/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          apiKey: geminiApiKey
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate image with Gemini');
      }
      
      const data = await response.json();
      const imageUrl = `data:image/jpeg;base64,${data.imageData}`;
      
      setGeneratedImage(imageUrl);
      onImageGenerated(imageUrl);
      
      const endTime = performance.now();
      setGenerationTime((endTime - startTime) / 1000);
    } catch (error) {
      console.error('Error generating image with Gemini:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate image with Gemini');
    } finally {
      setGeneratingGemini(false);
    }
  };

  // Generate image with GetImg
  const generateGetImgImage = async () => {
    if (!prompt) {
      setError('Please enter a description');
      return;
    }
    
    if (!selectedModel) {
      setError('Please select a model');
      return;
    }
    
    setError(null);
    setGeneratingGetImg(true);
    setCurrentGenerator('getimg');
    const startTime = performance.now();
    
    try {
      const response = await fetch('/api/generate-image/getimg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          negative_prompt: negativePrompt,
          model: selectedModel
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate image with GetImg');
      }
      
      const data = await response.json();
      const imageUrl = `data:image/jpeg;base64,${data.imageData}`;
      
      setGeneratedImage(imageUrl);
      onImageGenerated(imageUrl);
      
      const endTime = performance.now();
      setGenerationTime((endTime - startTime) / 1000);
    } catch (error) {
      console.error('Error generating image with GetImg:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate image with GetImg');
    } finally {
      setGeneratingGetImg(false);
    }
  };

  return (
    <div className="image-generator">
      <div className="form-group">
        <label htmlFor="geminiApiKey">Your Gemini API Key:</label>
        <input 
          type="text"
          id="geminiApiKey"
          value={geminiApiKey}
          onChange={(e) => setGeminiApiKey(e.target.value)}
          placeholder="Enter your Gemini API key to use Gemini image generation"
        />
        <small>Required for Gemini image generation. Get it from <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer">Google AI Studio</a>.</small>
      </div>

      <div className="form-group">
        <label htmlFor="modelSelect">GetImg Model:</label>
        <select 
          id="modelSelect"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
        >
          <option value="">Select a model</option>
          {models.map((model) => (
            <option 
              key={model.id} 
              value={`${model.id}:${model.family}`}
            >
              {model.name} ({model.family})
            </option>
          ))}
        </select>
        <small>GetImg API is used with our API key. Free to use!</small>
      </div>

      <div className="form-group">
        <label htmlFor="prompt">Image Description:</label>
        <input 
          type="text"
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your image description..."
        />
      </div>

      <div className="form-group">
        <label htmlFor="negativePrompt">Negative Prompt (GetImg only):</label>
        <input 
          type="text"
          id="negativePrompt"
          value={negativePrompt}
          onChange={(e) => setNegativePrompt(e.target.value)}
          placeholder="What to avoid in the image (GetImg only)..."
        />
      </div>

      <div className="button-group">
        <button 
          onClick={generateGeminiImage} 
          disabled={generatingGemini || generatingGetImg || !geminiApiKey}
          className={!geminiApiKey ? 'disabled' : ''}
        >
          {generatingGemini ? 'Generating...' : 'Generate with Gemini'}
        </button>
        
        <button 
          onClick={generateGetImgImage}
          disabled={generatingGemini || generatingGetImg || !selectedModel}
          className={!selectedModel ? 'disabled' : ''}
        >
          {generatingGetImg ? 'Generating...' : 'Generate with GetImg'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          Error: {error}
        </div>
      )}

      {generatedImage && (
        <div className="result-box">
          <h3>{currentGenerator === 'gemini' ? 'Gemini' : 'GetImg'} Generated Image</h3>
          <div className="image-container">
            <img src={generatedImage} alt="Generated" className="generated-image" />
          </div>
          
          {generationTime !== null && (
            <div className="timing">
              Generation time: {generationTime.toFixed(2)}s
            </div>
          )}
        </div>
      )}
    </div>
  );
} 