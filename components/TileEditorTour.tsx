import React, { useEffect, useRef } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_STORAGE_KEY = 'minilogos-tile-editor-tour-completed';

const tourSteps: DriveStep[] = [
  {
    element: '#tour-style-variant',
    popover: {
      title: '1. Style Variant',
      description: 'Choose your graphics style: Default (McMarkis), DREZZ\'s custom graphics, or Custom to import your own designs.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '#tour-export-import',
    popover: {
      title: '2. Export & Import',
      description: 'Export presets as .aseprite, .jim, or .png files. When "Custom" style is selected, use Import to load your edited graphics.',
      side: 'right',
      align: 'center',
    },
    onHighlightStarted: () => {
      // Scroll to show the export/import buttons
      const el = document.querySelector('#tour-export-import');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
  },
  {
    element: '#tour-map-canvas',
    popover: {
      title: '3. Preview Canvas',
      description: 'View your graphics in the main canvas. Switch between Map view (assembled layout), Tileset (individual tiles), and Palettes.',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '#tour-zoom-controls',
    popover: {
      title: '4. Zoom Controls',
      description: 'Adjust the zoom level to see your graphics in detail. Supports 1x to 8x magnification.',
      side: 'bottom',
      align: 'end',
    },
  },
  {
    element: '#tour-tile-video-tutorial',
    popover: {
      title: '5. Video Tutorial',
      description: 'Need help with custom tile editing? Click here to watch a step-by-step video tutorial.',
      side: 'right',
      align: 'end',
    },
    onHighlightStarted: () => {
      // Scroll to show the video tutorial button
      const el = document.querySelector('#tour-tile-video-tutorial');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    },
  },
];

const TileEditorTour: React.FC = () => {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  useEffect(() => {
    // Check if tour has already been completed
    const tourCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
    if (tourCompleted === 'true') return;

    // Wait for DOM to be fully loaded
    const timeoutId = setTimeout(() => {
      // Verify all tour elements exist before starting
      const allElementsExist = tourSteps.every(step => {
        if (typeof step.element === 'string') {
          return document.querySelector(step.element) !== null;
        }
        return true;
      });

      if (!allElementsExist) {
        console.warn('TileEditorTour: Not all elements found, skipping tour');
        return;
      }

      driverRef.current = driver({
        showProgress: true,
        showButtons: ['next', 'previous', 'close'],
        steps: tourSteps,
        progressText: '{{current}} of {{total}}',
        nextBtnText: 'Next →',
        prevBtnText: '← Previous',
        doneBtnText: 'Done',
        popoverClass: 'driverjs-custom-theme',
        onDestroyStarted: () => {
          // Mark tour as completed when user closes or finishes
          localStorage.setItem(TOUR_STORAGE_KEY, 'true');
          driverRef.current?.destroy();
        },
      });

      driverRef.current.drive();
    }, 500); // Small delay to ensure DOM is ready

    return () => {
      clearTimeout(timeoutId);
      driverRef.current?.destroy();
    };
  }, []);

  return null; // This component doesn't render anything
};

export default TileEditorTour;
