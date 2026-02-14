export const FEED_SETTINGS = {
  onPostClick: {
    DETAILED_POPUP: 'detailed_popup',
    MINIMAL_POPUP: 'minimal_popup',
    GO_TO_INSTAGRAM: 'go_to_instagram',
    DO_NOTHING: 'do_nothing',
  },
  postSpacing: {
    SMALL: 'small',
    MEDIUM: 'medium',
    LARGE: 'large',
    NONE: 'none',
  },
  roundedCorners: {
    NONE: 'none',
    SMALL: 'small',
    MEDIUM: 'medium',
    LARGE: 'large',
  },
  layout: {
    SLIDER: 'slider',
    GRID: 'grid',
  },
  format: {
    '3:4': '3:4',
    '4:5': '4:5',
    '1:1': '1:1',
    '9:16': '9:16',
    '4:3': '4:3',
    CIRCLE: 'circle',
  },
  responsiveLayout: {
    AUTO: 'auto',
  },
  sliderBehavior: {
    STATIC: 'static',
    AUTO_ROTATE: 'auto_rotate',
  },
};

export function validateFeedSettings(settings) {
  const errors = {};
  if (settings.onPostClick && !Object.values(FEED_SETTINGS.onPostClick).includes(settings.onPostClick)) {
    errors.onPostClick = 'Invalid onPostClick value';
  }
  if (settings.postSpacing && !Object.values(FEED_SETTINGS.postSpacing).includes(settings.postSpacing)) {
    errors.postSpacing = 'Invalid postSpacing value';
  }
  return Object.keys(errors).length > 0 ? errors : null;
}