import Tts from 'react-native-tts';

export async function speakZoneWarning(zoneName: string, isDemo: boolean) {
  await Tts.setDefaultLanguage('en-NG');
  await Tts.stop();
  Tts.speak(
    isDemo
      ? `RoadGuard demo alert. This is an illustrative area, not an official enforcement location. ${zoneName}.`
      : `RoadGuard alert. You are near ${zoneName}. Drive safely and follow posted instructions.`,
  );
}
