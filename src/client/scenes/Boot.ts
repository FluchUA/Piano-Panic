import { Scene } from 'phaser';

export class Boot extends Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // Load only the tiny asset needed before the shared loader overlay appears.
    this.load.image('background', '../assets/bg.png');
  }

  create() {
    this.scene.launch('LoaderScene');
    this.scene.start('InitScene');
  }
}
