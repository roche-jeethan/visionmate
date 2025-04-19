import { Dimensions } from 'react-native';

export type ObjectPosition = 'left' | 'right' | 'center';

export const getObjectPosition = (bbox: [number, number, number, number]): ObjectPosition => {
    const screenWidth = Dimensions.get('window').width;
    const centerLine = screenWidth / 2;
    
    // Calculate center point of the bounding box
    const objectCenterX = (bbox[0] + bbox[2]) / 2;
    
    console.log('Screen width:', screenWidth);
    console.log('Center line:', centerLine);
    console.log('Object center X:', objectCenterX);
    
    // Add a smaller dead zone (3% of screen width)
    const deadZone = screenWidth * 0.03;
    
    if (Math.abs(objectCenterX - centerLine) < deadZone) {
        return 'center';
    }
    return objectCenterX < centerLine ? 'left' : 'right';
};

export const getPositionAnnouncement = (
    position: ObjectPosition, 
    label: string,
    language: string
): string => {
    if (language === 'hi') {
        switch(position) {
            case 'left':
                return `${label} बाईं ओर है`;
            case 'right':
                return `${label} दाईं ओर है`;
            default:
                return `${label} सामने है`;
        }
    }
    
    switch(position) {
        case 'left':
            return `${label} is on the left`;
        case 'right':
            return `${label} is on the right`;
        default:
            return `${label} is in the center`;
    }
};