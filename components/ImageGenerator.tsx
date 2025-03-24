'use client';

import { useState, useEffect } from 'react';

// Add rate limit types
interface RateLimitResponse {
  allowed: boolean;
  remaining: number;
}

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
  const [isMounted, setIsMounted] = useState(false);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);

  // Handle initial client-side mounting
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch available models from GetImg API
  useEffect(() => {
    if (!isMounted) return;
    
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
  }, [isMounted]);

  // Add rate limit check
  const checkRateLimit = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/rate-limit');
      const data: RateLimitResponse = await response.json();
      setRateLimitRemaining(data.remaining);
      return data.allowed;
    } catch (error) {
      console.error('Error checking rate limit:', error);
      return false;
    }
  };

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

    // Check rate limit before proceeding with GetImg
    const isAllowed = await checkRateLimit();
    if (!isAllowed) {
      setError('Daily GetImg generation limit reached. Please try again tomorrow or use Gemini with your API key.');
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

  // If not mounted yet (during SSR), return a minimal structure to avoid hydration issues
  if (!isMounted) {
    return <div className="image-generator">Loading image generator...</div>;
  }

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

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '2rem'
      }}>
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

        <div className="rate-limit-container" style={{
          backgroundColor: '#f8f9fa',
          padding: '1rem',
          borderRadius: '8px',
          border: '1px solid #dee2e6',
          minWidth: '250px'
        }}>
          <h4 style={{ 
            margin: '0 0 0.5rem 0',
            color: '#212529',
            fontSize: '0.9rem'
          }}>
            GetImg Daily Credits
          </h4>
          
          <div style={{
            backgroundColor: '#fff',
            padding: '0.75rem',
            borderRadius: '6px',
            border: '1px solid #dee2e6'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#6c757d', marginBottom: '0.25rem' }}>
              Daily Limit: 10 GetImg generations
            </div>
            {rateLimitRemaining !== null && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                <div style={{
                  flex: 1,
                  height: '6px',
                  backgroundColor: '#e9ecef',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${(rateLimitRemaining / 10) * 100}%`,
                    height: '100%',
                    backgroundColor: rateLimitRemaining > 2 ? '#28a745' : rateLimitRemaining > 0 ? '#ffc107' : '#dc3545',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <div style={{
                  fontWeight: 'bold',
                  color: rateLimitRemaining > 2 ? '#28a745' : rateLimitRemaining > 0 ? '#ffc107' : '#dc3545'
                }}>
                  {rateLimitRemaining} left
                </div>
              </div>
            )}
          </div>
          
          <div style={{
            fontSize: '0.75rem',
            color: '#6c757d',
            marginTop: '0.5rem'
          }}>
            {rateLimitRemaining === null ? (
              'Loading...'
            ) : rateLimitRemaining > 0 ? (
              'GetImg credits reset daily at midnight UTC. Use Gemini with your API key for unlimited generations.'
            ) : (
              'GetImg limit reached. Use Gemini with your API key or wait until midnight UTC.'
            )}
          </div>
        </div>
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