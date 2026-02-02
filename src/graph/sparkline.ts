/**
 * Canvas-based sparkline renderer for nodes.
 */

export interface SparklineConfig {
  width: number;
  height: number;
  color: string;
  values: number[];
  backgroundColor?: string;
}

// Cache canvas for reuse
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

/**
 * Renders a sparkline chart and returns a data URL.
 */
export function renderSparkline(config: SparklineConfig): string {
  const { width, height, color, values, backgroundColor } = config;

  if (!values || values.length < 2) {
    return '';
  }

  // Create or reuse canvas
  if (!canvas) {
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
  }

  if (!ctx) {
    return '';
  }

  // Set canvas size (use 2x for retina displays)
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = height * scale;
  ctx.scale(scale, scale);

  // Clear canvas
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
  } else {
    ctx.clearRect(0, 0, width, height);
  }

  // Calculate min/max for scaling
  let min = values[0]!;
  let max = values[0]!;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }

  // Add padding to range
  const range = max - min || 1;
  const padding = range * 0.1;
  min -= padding;
  max += padding;

  // Calculate points
  const stepX = width / (values.length - 1);
  const scaleY = height / (max - min);

  // Draw line
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (let i = 0; i < values.length; i++) {
    const x = i * stepX;
    const y = height - (values[i]! - min) * scaleY;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.stroke();

  // Draw filled area under the line
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.closePath();
  ctx.fillStyle = color + '33'; // 20% opacity
  ctx.fill();

  // Reset scale for next render
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  return canvas.toDataURL('image/png');
}

/**
 * Creates a sparkline data URL with default styling.
 */
export function createNodeSparkline(values: number[]): string {
  if (!values || values.length < 2) {
    return '';
  }

  return renderSparkline({
    width: 50,
    height: 20,
    color: '#4ade80',
    values,
  });
}
