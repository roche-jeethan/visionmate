import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface BoundingBoxProps {
    bbox: [number, number, number, number];
    label: string;
    confidence: number;
}

export const BoundingBox: React.FC<BoundingBoxProps> = ({ bbox, label, confidence }) => {
    const [x1, y1, x2, y2] = bbox;
    
    return (
        <View
            style={[
                styles.box,
                {
                    left: x1,
                    top: y1,
                    width: x2 - x1,
                    height: y2 - y1,
                }
            ]}
        >
            <Text style={styles.label}>
                {`${label} ${(confidence * 100).toFixed(0)}%`}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    box: {
        position: 'absolute',
        borderWidth: 2,
        borderColor: '#00FF00',
        backgroundColor: 'transparent',
    },
    label: {
        position: 'absolute',
        top: -20,
        left: 0,
        backgroundColor: 'rgba(0, 255, 0, 0.7)',
        color: 'white',
        padding: 2,
        fontSize: 12,
    },
});