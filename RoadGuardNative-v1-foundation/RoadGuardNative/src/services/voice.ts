import Tts from 'react-native-tts';

export async function speakEnforcementWarning(speedLimitKmh: number) {
  await Tts.setDefaultLanguage('en-NG').catch(() => undefined);
  Tts.stop();
  Tts.speak(
    `Warning. Approaching enforcement zone. Remember your rights. Speed limit is ${speedLimitKmh} kilometres per hour.`,
  );
}
