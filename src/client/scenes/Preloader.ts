import { Scene } from 'phaser';
import { AppMode } from '../../shared/api';
import type { PostInfoResponse } from '../../shared/api';
import { AUDIO_SAMPLE_ASSETS } from '../audioSamples';

export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  init() {
    window.dispatchEvent(new CustomEvent('SHOW_PHASER_LOADER'));
  }

  preload() {
    this.load.setPath('../assets');
    this.load.image('background', 'bg.png');
    this.load.spritesheet('coin', 'button_test.png', { frameWidth: 100, frameHeight: 100 });

    AUDIO_SAMPLE_ASSETS.forEach((sample) => {
      this.load.audio(sample.key, sample.path);
    });
  }

  create() {
    this.anims.create({
      key: 'coin_spin',
      frames: this.anims.generateFrameNumbers('coin', { start: 0, end: 2 }),
      frameRate: 8,
      repeat: -1,
      yoyo: true,
    });

    const post = this.registry.get('post') as PostInfoResponse;
    const nextScene = !post || post.mode === AppMode.HUB ? 'MainMenu' : 'RateTrackScene';
    this.scene.start(nextScene);

    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('HIDE_PHASER_LOADER'));
    }, 80);
  }
}
