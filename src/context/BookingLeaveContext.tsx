import { createContext, PropsWithChildren, useContext, useMemo } from 'react';
import { Alert, Platform } from 'react-native';
import { usePathname } from 'expo-router';

import { createBookingLeaveGuard } from '../navigation/booking-leave-guard';

const BookingLeaveContext = createContext<ReturnType<typeof createBookingLeaveGuard> | null>(null);

export function BookingLeaveProvider({ children }: PropsWithChildren) {
  const guard = useMemo(() => createBookingLeaveGuard((leave, stay) => {
    const title = 'Keep your tee time in play';
    const message = "You\u2019re a few steps from confirming. If you leave now, another golfer could book this time.";
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) leave();
      else stay();
      return;
    }
    Alert.alert(title, message, [
      { text: 'Stay & Finish', style: 'cancel', onPress: stay },
      { text: 'Leave Booking', style: 'destructive', onPress: leave },
    ], { cancelable: true, onDismiss: stay });
  }), []);
  return <BookingLeaveContext.Provider value={guard}>{children}</BookingLeaveContext.Provider>;
}

export function useBookingLeaveGuard() {
  const guard = useContext(BookingLeaveContext);
  const pathname = usePathname();
  const scoped = useMemo(() => guard ? {
    register: guard.register,
    request: (destination: string | null, proceed: () => void) => guard.request(pathname, destination, proceed),
  } : null, [guard, pathname]);
  if (!scoped) throw new Error('BookingLeaveProvider is required.');
  return scoped;
}
