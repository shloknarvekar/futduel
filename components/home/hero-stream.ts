import { getImageProps } from 'next/image';
import type { StreamImage } from '@/components/ui/ImageStreamHero';

/**
 * The home hero's corridor: the photographs in the project's `Football/`
 * folder, copied byte for byte into `public/image-stream/` under URL-safe
 * names (the `.jfif` files are JPEGs, so they are served as `.jpg`).
 *
 * The set is 18 portrait phone wallpapers (0.45–0.56), one near-square frame
 * and two 4K landscapes. A corridor card is 18:25, so a portrait shows about
 * two thirds of its height and a landscape under half its width; `position`
 * keeps each subject in frame. Most of these players stand in the lower half
 * of a dark stadium shot, which is why so many sit at 100%.
 *
 * Order is deliberate. The rails run it front to back, so the few bright
 * frames (white and yellow kits, the green of the Zidane shot) are spaced
 * between the night-stadium ones, and no two shirts of the same club meet.
 */
type Source = {
  file: string;
  width: number;
  height: number;
  /** CSS object-position for an 18:25 card. */
  position: string;
  /** Scale inside the card, where the subject is too small to read. */
  zoom?: number;
  /** What the frame shows, for whoever edits this list next. */
  note: string;
};

const SOURCES: Source[] = [
  { file: '105130972549495020.jpg', width: 736, height: 1595, position: '50% 28%', note: 'white kit, celebrating; bright' },
  { file: 'best-erling-haaland-iphone-and-android-wallpaper-focused-and-ready.jpg', width: 474, height: 844, position: '50% 100%', note: 'Haaland, dark; subject in lower half' },
  { file: '15606066.jpg', width: 4096, height: 2731, position: '38% 50%', note: 'landscape trophy lift; subject and trophy left of centre' },
  { file: 'lamine-yamal-wallpaper-19.jpg', width: 474, height: 1049, position: '50% 88%', note: 'Yamal, very dark; subject low, with air above the head' },
  { file: 'mbappe.jpg', width: 736, height: 843, position: '40% 50%', note: 'Mbappé volley; near square, bright crowd' },
  { file: 'materazzi-and-rui-costa-iconic-san-siro-moment-4k-wallpaper.jpg', width: 736, height: 1308, position: '50% 60%', note: 'Materazzi and Rui Costa, red flare smoke' },
  { file: 'thierry-henry-4k-wallpaper-france.jpg', width: 474, height: 1025, position: '50% 45%', zoom: 1.25, note: 'Henry at the corner flag; zoomed past the ad board above him' },
  { file: 'barcola-psg-wallpaper.jpg', width: 474, height: 842, position: '50% 92%', note: 'Barcola, black ground; subject low' },
  { file: 'the-man-who-made-people-fall-in-love-with-football-ronaldinho-gaucho.jpg', width: 474, height: 1026, position: '50% 100%', note: 'Ronaldinho, warm and bright; subject low' },
  { file: '51791464460751121.jpg', width: 736, height: 1308, position: '50% 90%', note: 'sky-blue kit at the corner flag, night; black sky' },
  { file: 'ice-cold-football-wallpapers.jpg', width: 474, height: 925, position: '50% 50%', note: 'World Cup trophy and medal, blue light' },
  { file: 'michael-olise-photo-4k.jpg', width: 474, height: 1027, position: '50% 78%', note: 'Olise, red kit on black; hair clears the top edge' },
  { file: 'zidane-wallpaper-4k.jpg', width: 474, height: 933, position: '50% 92%', zoom: 1.45, note: 'Zidane passing the trophy; subject is small in frame, so it is zoomed' },
  { file: 'cold-football-pics-4k.jpg', width: 474, height: 842, position: '50% 100%', note: 'black kit in the rain, night' },
  { file: '48695239714941056.jpg', width: 736, height: 1595, position: '50% 75%', note: 'blue kit, arms folded; face mid-frame' },
  { file: 'ronaldo-best-photos.jpg', width: 474, height: 1027, position: '50% 88%', zoom: 1.4, note: 'Ronaldo celebration; small in frame, so it is zoomed' },
  { file: '1337074890377525.jpg', width: 736, height: 1593, position: '50% 25%', note: 'red kit knee slide in the rain; subject upper third' },
  { file: 'cold-football-images.jpg', width: 474, height: 842, position: '50% 85%', note: 'striped kit, hands over face, floodlights' },
  { file: 'paolo-maldini-hd-wallpaper-ac-milan.jpg', width: 474, height: 966, position: '50% 75%', note: 'Maldini with a trophy' },
  { file: '869757746840068027.jpg', width: 680, height: 1459, position: '50% 80%', note: 'sky-blue kit running, crowd behind' },
  { file: 'wp6683501-neymar-4k-wallpapers.jpg', width: 3840, height: 2400, position: '46% 50%', note: 'Neymar landscape; subject near centre' },
  { file: '28569778881799831.jpg', width: 736, height: 1644, position: '50% 55%', note: 'blue No. 25 kneeling, arms up' },
];

/**
 * A corridor card is never wider than about a third of the corridor, which
 * spans the viewport, so that is what the browser is told to fetch for.
 * The optimiser never upscales, so the portrait files top out at their own
 * width, and the two 4K files arrive as a few hundred kilobytes.
 */
const SIZES = '34vw';

export const HERO_STREAM: StreamImage[] = SOURCES.map(({ file, width, height, position, zoom }) => {
  const { props } = getImageProps({
    src: `/image-stream/${file}`,
    alt: '',
    width,
    height,
    sizes: SIZES,
    quality: 72,
  });
  return { src: props.src, srcSet: props.srcSet, sizes: SIZES, position, zoom, alt: '' };
});
