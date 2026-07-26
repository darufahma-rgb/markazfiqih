import { useEffect } from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

const BRAND_NAME = 'Kelas Markaz Fiqih';
const DEFAULT_DESCRIPTION =
  "Ahlan wa Sahlan di Kelas Markaz Fiqih. Tempat belajar fiqih madzhab Syafi'i yang sistematis dan terstruktur.";

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  image = 'https://kelasmarkazfiqih.com/opengraph.jpg',
  url = 'https://kelasmarkazfiqih.com/',
}: SEOProps) {
  const fullTitle =
    !title || title === BRAND_NAME
      ? BRAND_NAME
      : title.includes(BRAND_NAME)
      ? title
      : `${title} – ${BRAND_NAME}`;

  useEffect(() => {
    // 1. Update Document Title
    document.title = fullTitle;

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
    setMetaTag('og:title', 'property', fullTitle);
    setMetaTag('og:description', 'property', description);
    setMetaTag('og:url', 'property', url);
    setMetaTag('og:image', 'property', image);

    // Twitter Meta
    setMetaTag('twitter:title', 'name', fullTitle);
    setMetaTag('twitter:description', 'name', description);
    setMetaTag('twitter:image', 'name', image);
  }, [fullTitle, description, image, url]);

  return null;
}
