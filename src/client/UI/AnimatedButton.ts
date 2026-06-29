import Phaser from "phaser";

type AnimatedButtonConfig = {
  scene: Phaser.Scene;
  x: number;
  y: number;
  texture: string;
  animationKey: string;
  onClick: () => void;
  scale?: number;
};

export class AnimatedButton extends Phaser.GameObjects.Sprite {
  constructor(cfg: AnimatedButtonConfig) {
    super(cfg.scene, cfg.x, cfg.y, cfg.texture);

    cfg.scene.add.existing(this);

    if (cfg.scale) this.setScale(cfg.scale);
    this.play(cfg.animationKey);

    this.setInteractive({ useHandCursor: true });
    this.on("pointerdown", () => {
      cfg.onClick();
    });
  }
}