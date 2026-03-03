import React, { useEffect, useRef } from 'react';
import { driver, DriveStep } from 'driver.js';
import 'driver.js/dist/driver.css';

const TOUR_STORAGE_KEY = 'minilogos-tour-completed';

const tourSteps: DriveStep[] = [
  {
    element: '#tour-rom-file',
    popover: {
      title: '1. ROM File',
      description: 'Start by uploading your NHL \'94 Genesis ROM file. Drag & drop or click to browse. You can also toggle 30/32 team ROM support here.',
      side: 'right',
      align: 'start',
    },
  },
  {
    element: '#tour-patch-mode',
    popover: {
      title: '2. Patch Mode',
      description: 'Choose your patch mode: "Banners & Mini Logos" for the full experience, or "Mini Logos Only" for just the gameplay mini logos.',
      side: 'right',
      align: 'center',
    },
  },
  {
    element: '#tour-features',
    popover: {
      title: '3. Features',
      description: 'Toggle individual features on or off. Enable Team Select Banners, In-Game Banners, Playoff Brackets, and Mini Logos based on your preferences.',
      side: 'right',
      align: 'start',
    },
    onHighlightStarted: () => {
      // Scroll the sidebar to show the features section
      const featuresEl = document.querySelector('#tour-features');
      if (featuresEl) {
        featuresEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
  },
  {
    element: '#tour-tile-editor',
    popover: {
      title: '4. Tile Editor',
      description: 'Use the Tile Editor tab to customize banners and logos. Export presets to Aseprite, edit them, and re-import your custom designs.',
      side: 'bottom',
      align: 'center',
    },
  },
  {
    element: '#tour-video-tutorial',
    popover: {
      title: '5. Video Tutorial',
      description: 'Need help? Click here to watch a video tutorial that walks you through the patching process step by step.',
      side: 'right',
      align: 'end',
    },
  },
];

const GuidedTour: React.FC = () => {
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
        console.warn('GuidedTour: Not all elements found, skipping tour');
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

export default GuidedTour;
