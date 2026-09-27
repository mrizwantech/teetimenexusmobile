import { Platform, StyleSheet } from 'react-native';

export const colors = {
  bg: '#050505',
  surface: '#121212',
  surfaceStrong: '#0A0C0C',
  surfaceSoft: '#181818',
  primary: '#A1E04C',
  primaryHover: '#B5F565',
  primaryContrast: '#101010',
  text: '#F5F5F5',
  heading: '#FFFFFF',
  muted: '#B8B8B8',
  subtle: '#D7D7D7',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  danger: '#FCA5A5',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const shadows = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOpacity: 0.42,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  android: { elevation: 8 },
  default: {},
});

export const brandMarkStyles = StyleSheet.create({
  container: { gap: 1 },
  top: {
    color: colors.heading,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  bottom: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
});

export const primaryButtonStyles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 50,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondary: { backgroundColor: 'transparent', borderColor: colors.borderStrong, borderWidth: 1 },
  disabled: { backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderWidth: 1 },
  pressed: { opacity: 0.72 },
  label: { color: colors.primaryContrast, fontSize: 15, fontWeight: '800' },
  secondaryLabel: { color: colors.heading },
  disabledLabel: { color: colors.subtle },
});

export const screenStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 40, gap: spacing.lg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});

export const sectionCardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    ...shadows,
  },
});

export const bottomNavStyles = StyleSheet.create({
  nav: {
    backgroundColor: colors.surfaceStrong,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: spacing.sm,
    paddingTop: spacing.sm,
  },
  item: { alignItems: 'center', gap: 4, minWidth: 72, paddingVertical: 4 },
  label: { color: colors.subtle, fontSize: 11, fontWeight: '700' },
  active: { color: colors.primary },
  dot: { backgroundColor: colors.primary, borderRadius: 3, height: 4, width: 4 },
});

export const signaturePadStyles = StyleSheet.create({
  shotWrapper: { backgroundColor: '#ffffff', borderRadius: 10 },
  pad: { height: 160, width: '100%' },
  svg: StyleSheet.absoluteFill,
});

export const checkoutStyles = StyleSheet.create({
  center: { alignItems: 'center', backgroundColor: colors.bg, flex: 1, justifyContent: 'center', padding: 24 },
  text: { color: colors.muted, fontSize: 15, marginTop: 14 },
  error: { color: colors.danger, fontSize: 15, textAlign: 'center' },
});

export const membershipStyles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.heading, fontSize: 34, fontWeight: '900' },
  intro: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  currentPanel: { backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.md },
  accountPanel: { backgroundColor: colors.surface, borderColor: colors.borderStrong, borderRadius: radii.md, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  accountHeading: { color: colors.heading, fontSize: 18, fontWeight: '800' },
  accountCopy: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  input: { backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: radii.sm, borderWidth: 1, color: colors.text, fontSize: 15, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  currentLabel: { color: colors.primaryContrast, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  currentTitle: { color: colors.primaryContrast, fontSize: 22, fontWeight: '900', marginTop: 4 },
  currentStatus: { color: colors.primaryContrast, fontSize: 13, marginTop: 4, textTransform: 'capitalize' },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  featuredCard: { borderColor: colors.primary, borderWidth: 2 },
  featuredLabel: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  kicker: { color: colors.primary, fontSize: 12, fontWeight: '900', letterSpacing: 1.6 },
  priceRow: { alignItems: 'baseline', flexDirection: 'row' },
  price: { color: colors.heading, fontSize: 36, fontWeight: '900' },
  month: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  regularPrice: { color: colors.subtle, fontSize: 13, textDecorationLine: 'line-through' },
  features: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.sm, marginVertical: spacing.sm, paddingTop: spacing.md },
  feature: { color: colors.text, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 14 },
});

export const accountStyles = StyleSheet.create({
  label: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.heading, fontSize: 34, fontWeight: '900' },
  cardTitle: { color: colors.heading, fontSize: 20, fontWeight: '800', marginBottom: 10 },
  sectionTitle: { color: colors.heading, fontSize: 17, fontWeight: '800', marginTop: spacing.md, marginBottom: spacing.sm },
  accountLine: { color: colors.primary, fontSize: 14, fontWeight: '700', marginBottom: spacing.sm },
  bookingRow: { borderTopColor: colors.border, borderTopWidth: 1, paddingVertical: spacing.sm },
  bookingTitle: { color: colors.text, fontSize: 14, fontWeight: '800' },
  bookingText: { color: colors.muted, fontSize: 13, marginTop: 3, textTransform: 'capitalize' },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23, marginBottom: 20 },
  error: { color: colors.danger, fontSize: 14, marginBottom: 12 },
  input: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    fontSize: 15,
  },
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: spacing.xl },
  eyeButton: { position: 'absolute', right: spacing.sm, padding: spacing.xs },
  eyeIcon: { fontSize: 18 },
});

export const homeStyles = StyleSheet.create({
  carousel: { backgroundColor: colors.surfaceStrong, borderRadius: 24, height: 440, overflow: 'hidden' },
  slide: { height: 440, justifyContent: 'flex-end', padding: spacing.md },
  slideImage: { borderRadius: 24 },
  copyPanel: { backgroundColor: 'rgba(6, 10, 10, 0.78)', borderColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 18, borderWidth: 1, gap: spacing.md, padding: spacing.lg },
  kicker: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1.6 },
  title: { color: colors.heading, fontSize: 30, fontWeight: '900', lineHeight: 34 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  live: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heading: { paddingTop: spacing.sm },
  sectionTitle: { color: colors.heading, fontSize: 24, fontWeight: '800' },
  cardTitle: { color: colors.heading, fontSize: 20, fontWeight: '800', marginVertical: 8 },
  arrow: { alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.16)', borderColor: 'rgba(255, 255, 255, 0.28)', borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', position: 'absolute', top: 198, width: 44 },
  previousArrow: { left: spacing.sm },
  nextArrow: { right: spacing.sm },
  arrowText: { color: colors.heading, fontSize: 32, fontWeight: '300', lineHeight: 34 },
  dots: { bottom: spacing.md, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', left: 0, position: 'absolute', right: 0 },
  dot: { backgroundColor: 'rgba(255, 255, 255, 0.55)', borderRadius: 5, height: 10, width: 10 },
  activeDot: { backgroundColor: colors.primary },
  modalBackdrop: { backgroundColor: 'rgba(0, 0, 0, 0.72)', flex: 1, justifyContent: 'flex-end' },
  modalScrollContent: { flexGrow: 1, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.bg, borderColor: colors.borderStrong, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl },
  closeButton: { alignItems: 'center', alignSelf: 'flex-end', height: 36, justifyContent: 'center', width: 36 },
  closeText: { color: colors.muted, fontSize: 30, fontWeight: '300' },
  modalTitle: { color: colors.heading, fontSize: 34, fontWeight: '900', textAlign: 'center' },
  modalSubtitle: { color: colors.muted, fontSize: 16, textAlign: 'center' },
  modalBody: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  field: { gap: spacing.xs },
  fieldLabel: { color: colors.heading, fontSize: 14, fontWeight: '800' },
  modalInput: { backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderRadius: 14, borderWidth: 1, color: colors.text, fontSize: 15, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  privacyNote: { color: colors.subtle, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 14 },
});

export const bookingStyles = StyleSheet.create({
  step: { color: colors.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: colors.heading, fontSize: 34, fontWeight: '900', marginTop: 8 },
  body: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 10, marginBottom: 4 },
  label: { color: colors.heading, fontSize: 15, fontWeight: '800', marginBottom: 10, marginTop: 4 },
  options: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  optionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  selected: { backgroundColor: colors.primary },
  option: { borderColor: colors.borderStrong, borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 11 },
  optionDisabled: { opacity: 0.35 },
  selectedText: { color: colors.primaryContrast, fontWeight: '800' },
  optionText: { color: colors.text, fontWeight: '700' },
  optionTextDisabled: { color: colors.subtle },
  dateInput: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: 22,
  },
  dateInputText: { color: colors.text, fontSize: 15 },
  dateInputPlaceholder: { color: colors.subtle, fontSize: 15 },
  summary: { color: colors.text, fontSize: 14, lineHeight: 22, marginBottom: 16 },
  summaryTotal: { color: colors.primary, fontWeight: '800' },
  sectionHeading: { color: colors.heading, fontSize: 20, fontWeight: '800', marginTop: spacing.sm, marginBottom: spacing.md },
  verifiedNote: { color: colors.primary, fontSize: 14, lineHeight: 21, marginBottom: spacing.lg },
  labelSpacer: { marginTop: spacing.md },
  hint: { color: colors.subtle, fontSize: 12, lineHeight: 18, marginBottom: spacing.sm },
  idPreview: { width: '100%', height: 160, borderRadius: 12, marginBottom: 10 },
  uploadButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: spacing.md,
    marginBottom: spacing.xs,
  },
  uploadButtonText: { color: colors.text, fontWeight: '700' },
  clearButton: { alignSelf: 'flex-start', marginTop: spacing.xs, marginBottom: spacing.md },
  clearButtonText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.lg },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: colors.bg, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: '#FFFFFF' },
  checkboxMark: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', lineHeight: 18 },
  termsText: { color: colors.text, fontSize: 14, lineHeight: 20, flex: 1 },
  error: { color: colors.danger, fontSize: 14, marginBottom: 12 },
  calendar: { backgroundColor: colors.surfaceSoft, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: spacing.sm, marginBottom: 22 },
  calendarHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  monthTitle: { color: colors.heading, fontSize: 15, fontWeight: '800' },
  monthButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  monthButtonDisabled: { opacity: 0.25 },
  monthButtonText: { color: colors.heading, fontSize: 28, lineHeight: 30 },
  weekRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: spacing.xs },
  weekDay: { color: colors.muted, fontSize: 12, fontWeight: '800', textAlign: 'center', width: 38 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { alignItems: 'center', height: 40, justifyContent: 'center', width: '14.2857%' },
  dayText: { color: colors.text, fontSize: 14, fontWeight: '700' },
  selectedDay: { backgroundColor: colors.primary, borderRadius: 20 },
  selectedDayText: { color: colors.primaryContrast, fontWeight: '900' },
  pastDay: { opacity: 0.3 },
  pastDayText: { color: colors.muted },
});