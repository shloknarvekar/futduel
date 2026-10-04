import type { Metadata } from 'next';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ImageStreamHero, type StreamImage } from '@/components/ui/ImageStreamHero';

/**
 * Preview of the ImageStreamHero component. Not linked from the navigation and
 * kept out of search.
 *
 * Images are served from this site only (the Content-Security-Policy allows no
 * other image host), so the preview shows whatever has been placed in
 * `public/image-stream/`, in file-name order, and says so when that is nothing.
 */
export const metadata: Metadata = {
  title: 'Image stream preview',
  robots: { index: false, follow: false },
};

const FOLDER = 'image-stream';
const IMAGE_FILE = /\.(avif|jpe?g|png|webp)$/i;

function localImages(): StreamImage[] {
  try {
    return readdirSync(join(process.cwd(), 'public', FOLDER))
      .filter((file) => IMAGE_FILE.test(file))
      .sort((a, b) => a.localeCompare(b))
      .map((file) => ({ src: `/${FOLDER}/${encodeURIComponent(file)}`, alt: '' }));
  } catch {
    // No folder yet is the same as no images.
    return [];
  }
}

export default function ImageStreamPreviewPage() {
  const images = localImages();

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <ImageStreamHero
        images={images}
        className="h-[560px] w-full rounded-lg border border-border bg-background"
      >
        <div className="relative z-10 flex h-full flex-col items-center justify-between py-12 text-center">
          <div className="px-6">
            <h1 className="text-balance text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
              Your work,
              <br />
              front and centre.
            </h1>
          </div>
          <p className="max-w-md text-balance px-6 text-sm text-muted-foreground">
            {images.length > 0
              ? 'A hero that leads with the images instead of describing them. Swap in your own and the corridor rebuilds around them.'
              : `No images yet. Add JPG, PNG, WebP or AVIF files to public/${FOLDER}/ and reload; they are shown in file-name order.`}
          </p>
        </div>
      </ImageStreamHero>
    </div>
  );
}
