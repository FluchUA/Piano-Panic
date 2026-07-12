import { Scene } from 'phaser';

export class Boot extends Scene {
  constructor() {
    super('Boot');
  }

  // Starts the global loader and initialization
  create() {
    this.scene.launch('LoaderScene');
    this.scene.start('InitScene');
  }
}
