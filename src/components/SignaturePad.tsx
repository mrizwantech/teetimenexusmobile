import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { GestureResponderEvent, PanResponder, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import ViewShot from 'react-native-view-shot';
import type { ViewShotRef } from 'react-native-view-shot';
import { signaturePadStyles as styles } from '../theme';

export type SignaturePadHandle = {
    hasSignature: () => boolean;
    clear: () => void;
    capture: () => Promise<string>;
};

type SignaturePadProps = { onChange?: (hasSignature: boolean) => void };

export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(function SignaturePad({ onChange }, ref) {
    const [paths, setPaths] = useState<string[]>([]);
    const currentPath = useRef('');
    const viewShotRef = useRef<ViewShotRef>(null);

    // Kept in a ref so the PanResponder (created once) always calls the latest callback.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (event: GestureResponderEvent) => {
                const { locationX, locationY } = event.nativeEvent;
                currentPath.current = `M${locationX},${locationY}`;
                setPaths((prev) => [...prev, currentPath.current]);
                onChangeRef.current?.(true);
            },
            onPanResponderMove: (event: GestureResponderEvent) => {
                const { locationX, locationY } = event.nativeEvent;
                currentPath.current += ` L${locationX},${locationY}`;
                setPaths((prev) => [...prev.slice(0, -1), currentPath.current]);
            },
        })
    ).current;

    useImperativeHandle(ref, () => ({
        hasSignature: () => paths.length > 0,
        clear: () => {
            setPaths([]);
            onChangeRef.current?.(false);
        },
        capture: async () => {
            if (!viewShotRef.current?.capture) {
                throw new Error('Unable to capture signature.');
            }
            const uri = await viewShotRef.current.capture();
            return uri;
        },
    }));

    return (
        <ViewShot ref={viewShotRef} options={{ format: 'png', result: 'data-uri' }} style={styles.shotWrapper}>
            <View style={styles.pad} {...panResponder.panHandlers}>
                <Svg style={styles.svg}>
                    {paths.map((d, index) => (
                        <Path key={index} d={d} stroke="#101010" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    ))}
                </Svg>
            </View>
        </ViewShot>
    );
});
