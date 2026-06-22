import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@/i18n';
import { useImageSourceChooser } from '@/components/ImageSourceChooser';

// CC-IMG (DEC-275): the canonical take-photo/gallery chooser. Every image entry
// in the app reuses this one hook, so its two behaviours are locked here:
//   1. opening shows BOTH options ("tirar foto" and "galeria"),
//   2. each option fires the matching hidden <input> (camera has capture=environment),
//   3. picking a file calls onPick once and resets the input (re-pick the same file).

function Harness({ onPick }: { onPick: (file: File) => void }) {
  const chooser = useImageSourceChooser(onPick);
  return (
    <>
      <button onClick={chooser.open}>open-chooser</button>
      {chooser.element}
    </>
  );
}

function fileInputs() {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement>('input[type="file"]'),
  );
  const camera = inputs.find((i) => i.getAttribute('capture') === 'environment');
  const gallery = inputs.find((i) => i.getAttribute('capture') === null);
  return { camera, gallery };
}

describe('useImageSourceChooser (CC-IMG / DEC-275)', () => {
  it('renders one camera input and one gallery input (both accept images)', () => {
    render(<Harness onPick={vi.fn()} />);
    const { camera, gallery } = fileInputs();
    expect(camera).toBeTruthy();
    expect(gallery).toBeTruthy();
    expect(camera!.getAttribute('accept')).toBe('image/*');
    expect(gallery!.getAttribute('accept')).toBe('image/*');
    // The gallery input must NOT force the camera (so the OS picker opens).
    expect(gallery!.hasAttribute('capture')).toBe(false);
  });

  it('opening the chooser shows BOTH "take photo" and "gallery" options', async () => {
    render(<Harness onPick={vi.fn()} />);
    fireEvent.click(screen.getByText('open-chooser'));
    expect(await screen.findByText(/tirar foto agora/i)).toBeInTheDocument();
    expect(screen.getByText(/escolher da galeria/i)).toBeInTheDocument();
  });

  it('"take photo" fires the camera input (capture=environment), not the gallery', async () => {
    render(<Harness onPick={vi.fn()} />);
    const { camera, gallery } = fileInputs();
    const cameraClick = vi.spyOn(camera!, 'click').mockImplementation(() => {});
    const galleryClick = vi.spyOn(gallery!, 'click').mockImplementation(() => {});

    fireEvent.click(screen.getByText('open-chooser'));
    fireEvent.click(await screen.findByText(/tirar foto agora/i));

    expect(cameraClick).toHaveBeenCalledTimes(1);
    expect(galleryClick).not.toHaveBeenCalled();
  });

  it('"gallery" fires the gallery input, not the camera', async () => {
    render(<Harness onPick={vi.fn()} />);
    const { camera, gallery } = fileInputs();
    const cameraClick = vi.spyOn(camera!, 'click').mockImplementation(() => {});
    const galleryClick = vi.spyOn(gallery!, 'click').mockImplementation(() => {});

    fireEvent.click(screen.getByText('open-chooser'));
    fireEvent.click(await screen.findByText(/escolher da galeria/i));

    expect(galleryClick).toHaveBeenCalledTimes(1);
    expect(cameraClick).not.toHaveBeenCalled();
  });

  it('calls onPick once with the chosen file and clears the input (so the same file can be re-picked)', () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    const { gallery } = fileInputs();
    const file = new File(['x'], 'receipt.jpg', { type: 'image/jpeg' });

    fireEvent.change(gallery!, { target: { files: [file] } });

    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(file);
    expect(gallery!.value).toBe('');
  });

  it('does not call onPick when the picker is dismissed with no file', () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    const { gallery } = fileInputs();

    fireEvent.change(gallery!, { target: { files: [] } });

    expect(onPick).not.toHaveBeenCalled();
  });
});
