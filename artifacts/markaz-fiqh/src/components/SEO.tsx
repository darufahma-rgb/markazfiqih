import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

const DEFAULT_TITLE = 'Kelas Markaz Fiqih';
const DEFAULT_DESCRIPTION =
  "Ahlan wa Sahlan di Kelas Markaz Fiqih. Tempat belajar fiqih madzhab Syafi'i yang sistematis dan terstruktur.";

export function SEO({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  image = 'https://kelasmarkazfiqih.vercel.app/opengraph.jpg',
  url = 'https://kelasmarkazfiqih.vercel.app/',
}: SEOProps) {
  useEffect(() => {
    // 1. Update Document Title
    document.title = title;

    // 2. Helper to set or create meta tag
    const setMetaTag = (nameOrProperty: string, key: 'name' | 'property', content: string) => {
      let element = document.querySelector(`meta[${key}="${nameOrProperty}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(key, nameOrProperty);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Standard Meta
    setMetaTag('description', 'name', description);
    setMetaTag('robots', 'name', 'index, follow');

    // OpenGraph Meta
    setMetaTag('og:title', 'property', title);
    setMetaTag('og:description', 'property', description);
    setMetaTag('og:url', 'property', url);
    setMetaTag('og:image', 'property', image);

    // Twitter Meta
    setMetaTag('twitter:title', 'name', title);
    setMetaTag('twitter:description', 'name', description);
    setMetaTag('twitter:image', 'name', image);
  }, [title, description, image, url]);

  return null;
}
