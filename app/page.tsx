'use client';

import { useState } from 'react';
import ImageGenerator from '@/components/ImageGenerator';
import AsciiConverter from '@/components/AsciiConverter';
import styles from './page.module.css';

export default function Home() {
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  // Handler for when an image is generated
  const handleImageGenerated = (imageUrl: string) => {
    setCurrentImageUrl(imageUrl);
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>ASCII Art Image Generator</h1>
        
        <p className={styles.description}>
          Generate images with AI and convert them to ASCII art. You can use either Gemini (requires your API key) 
          or GetImg (free to use with our API key).
        </p>
        
        <div className={styles.content}>
          <section className={styles.generatorSection}>
            <h2>Image Generation</h2>
            <ImageGenerator onImageGenerated={handleImageGenerated} />
          </section>
          
          {currentImageUrl && (
            <section className={styles.converterSection}>
              <h2>ASCII Conversion</h2>
              <AsciiConverter imageUrl={currentImageUrl} />
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
