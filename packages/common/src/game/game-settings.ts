import { Rules } from '../store/state/rules';

export class GameSettings {

  rules: Rules = new Rules();

  timeLimit: number = 1800;

  recordingEnabled: boolean = true;

  // Id of the deck the invited bot should play, chosen by the inviting player.
  // When missing/invalid, the bot falls back to picking a random valid deck.
  botDeckId?: number;

}
