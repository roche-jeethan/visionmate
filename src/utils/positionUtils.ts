import { Dimensions } from 'react-native';

export type ObjectPosition = 'left' | 'right' | 'center';

export const getObjectPosition = (bbox: [number, number, number, number]): ObjectPosition => {
    const screenWidth = Dimensions.get('window').width;

    // Check if coordinates look normalized (all values <= 1.2 to be safe, usually 1.0)
    // We check max value of the box.
    const isNormalized = bbox[0] <= 1.2 && bbox[2] <= 1.2;

    const limit = isNormalized ? 1.0 : screenWidth;

    // Calculate center point of the bounding box
    const objectCenterX = (bbox[0] + bbox[2]) / 2;

    // Define zones (Left < 35%, Center 35-65%, Right > 65%)
    if (objectCenterX < limit * 0.35) {
        return 'left';
    } else if (objectCenterX > limit * 0.65) {
        return 'right';
    } else {
        return 'center';
    }
};

export const getPositionAnnouncement = (
    position: ObjectPosition,
    label: string,
    language: string
): string => {
    if (language === 'hi') {
        switch (position) {
            case 'left':
                return `${label} बाईं ओर है`;
            case 'right':
                return `${label} दाईं ओर है`;
            default:
                return `${label} सामने है`;
        }
    }

    switch (position) {
        case 'left':
            return `${label} is on the left`;
        case 'right':
            return `${label} is on the right`;
        default:
            return `${label} is in the center`;
    }
};