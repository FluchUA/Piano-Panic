import { Scene } from 'phaser';
import { AppMode } from '../../shared/api';
import type { PostInfoResponse } from '../../shared/api';
import { AUDIO_SAMPLE_ASSETS } from '../audioSamples';
import { INSTRUMENT_MINI_ASSETS } from '../utils/instrumentMiniatures';

export class Preloader extends Scene {
  constructor() {
    super('Preloader');
  }

  init() {
    window.dispatchEvent(new CustomEvent('SHOW_PHASER_LOADER'));
  }

  preload() {
    this.load.setPath('../assets');
    this.load.image('background', 'background/main_menu_bg.png');
    this.load.image('user_records_bg', 'background/user_records_bg.png');
    this.load.image('shop_bg', 'background/shop_bg.png');
    this.load.image('create_record_bg', 'background/create_track_bg.png');
    this.load.image('dialog_bg', 'background/dialog_bg.png');
    this.load.spritesheet('middle_round_button_bg', 'UI/round_button/middle/middle_round_button_bg.png', { frameWidth: 70, frameHeight: 70 });
    this.load.spritesheet('middle_round_back_icon', 'UI/round_button/middle/middle_round_back_icon_anim.png', { frameWidth: 70, frameHeight: 70 });
    this.load.spritesheet('middle_round_info_icon', 'UI/round_button/middle/middle_round_info_icon_anim.png', { frameWidth: 70, frameHeight: 70 });
    this.load.spritesheet('middle_text_button_bg', 'UI/text_button/middle/middle_text_button_bg_anim.png', { frameWidth: 336, frameHeight: 54 });
    this.load.spritesheet('middle_text_button_compose', 'UI/text_button/middle/middle_text_button_compose_anim.png', { frameWidth: 336, frameHeight: 54 });
    this.load.spritesheet('middle_text_button_emporium', 'UI/text_button/middle/middle_text_button_emporium_anim.png', { frameWidth: 336, frameHeight: 54 });
    this.load.spritesheet('middle_text_button_listen_again', 'UI/text_button/middle/middle_text_button_listen_again_anim.png', { frameWidth: 336, frameHeight: 54 });
    this.load.spritesheet('middle_text_button_listen', 'UI/text_button/middle/middle_text_button_listen_anim.png', { frameWidth: 336, frameHeight: 54 });
    this.load.spritesheet('middle_text_button_records', 'UI/text_button/middle/middle_text_button_records_anim.png', { frameWidth: 336, frameHeight: 54 });
    this.load.spritesheet('small_text_button_bg', 'UI/text_button/small/small_text_button_bg_anim.png', { frameWidth: 190, frameHeight: 54 });
    this.load.spritesheet('small_text_button_cancel', 'UI/text_button/small/small_text_button_cancel_anim.png', { frameWidth: 190, frameHeight: 54 });
    this.load.spritesheet('small_text_button_leave', 'UI/text_button/small/small_text_button_leave_anim.png', { frameWidth: 190, frameHeight: 54 });
    this.load.spritesheet('small_text_button_ok', 'UI/text_button/small/small_text_button_ok_anim.png', { frameWidth: 190, frameHeight: 54 });
    this.load.spritesheet('small_round_button_bg', 'UI/round_button/small/small_round_button_bg.png', { frameWidth: 58, frameHeight: 58 });
    this.load.spritesheet('small_round_pause_icon', 'UI/round_button/small/small_round_pause_icon_anim.png', { frameWidth: 58, frameHeight: 58 });
    this.load.spritesheet('small_round_play_icon', 'UI/round_button/small/small_round_play_icon_anim.png', { frameWidth: 58, frameHeight: 58 });
    this.load.spritesheet('small_round_record_icon', 'UI/round_button/small/small_round_record_icon_anim.png', { frameWidth: 58, frameHeight: 58 });
    this.load.spritesheet('small_round_remove_icon', 'UI/round_button/small/small_round_remove_icon_anim.png', { frameWidth: 58, frameHeight: 58 });
    this.load.spritesheet('small_round_replay_icon', 'UI/round_button/small/small_round_replay_icon_anim.png', { frameWidth: 58, frameHeight: 58 });
    this.load.spritesheet('small_round_save_icon', 'UI/round_button/small/small_round_save_icon_anim.png', { frameWidth: 58, frameHeight: 58 });
    this.load.spritesheet('small_round_stop_icon', 'UI/round_button/small/small_round_stop_icon_anim.png', { frameWidth: 58, frameHeight: 58 });
    this.load.spritesheet('middle_square_button_bg', 'UI/square_button/middle/middle_square_button_bg.png', { frameWidth: 60, frameHeight: 60 });
    this.load.spritesheet('middle_square_play_icon', 'UI/square_button/middle/middle_square_play_icon_anim.png', { frameWidth: 60, frameHeight: 60 });
    this.load.spritesheet('small_square_button_bg', 'UI/square_button/small/small_square_button_bg.png', { frameWidth: 50, frameHeight: 50 });
    this.load.spritesheet('small_square_done_icon', 'UI/square_button/small/small_square_done_icon_anim.png', { frameWidth: 50, frameHeight: 50 });
    this.load.spritesheet('small_square_oct_icon', 'UI/square_button/small/small_square_oct_icon_anim.png', { frameWidth: 50, frameHeight: 50 });
    this.load.spritesheet('small_square_remove_icon', 'UI/square_button/small/small_square_remove_icon_anim.png', { frameWidth: 50, frameHeight: 50 });
    this.load.spritesheet('arrow_button', 'UI/arrow_button_anim.png', { frameWidth: 50, frameHeight: 50 });
    this.load.spritesheet('progress_anim', 'progress_anim.png', { frameWidth: 500, frameHeight: 500 });
    this.load.spritesheet('currency', 'currency_anim.png', { frameWidth: 80, frameHeight: 60 });
    this.load.spritesheet('metronome', 'metronome_anim.png', { frameWidth: 59, frameHeight: 120 });
    this.load.spritesheet('sustain', 'sustain_anim.png', { frameWidth: 50, frameHeight: 30 });
    this.load.spritesheet('piano_hold_bg', 'background/Instruments/piano_hold_bg.png', { frameWidth: 540, frameHeight: 470 });
    this.load.spritesheet('synth_hold_bg', 'background/Instruments/synth_hold_bg.png', { frameWidth: 540, frameHeight: 470 });
    this.load.spritesheet('organ_hold_bg', 'background/Instruments/organ_hold_bg.png', { frameWidth: 540, frameHeight: 470 });
    this.load.spritesheet('retro_hold_bg', 'background/Instruments/retro_hold_bg.png', { frameWidth: 540, frameHeight: 470 });
    this.load.spritesheet('electro_hold_bg', 'background/Instruments/electro_hold_bg.png', { frameWidth: 540, frameHeight: 470 });
    INSTRUMENT_MINI_ASSETS.forEach(({ texture, path }) => {
      this.load.spritesheet(texture, path, { frameWidth: 50, frameHeight: 50 });
    });
    this.load.spritesheet('white_key_down', 'keys/white/white_key_down_anim.png', { frameWidth: 71, frameHeight: 124 });
    this.load.spritesheet('white_key_middle', 'keys/white/white_key_middle_anim.png', { frameWidth: 71, frameHeight: 124 });
    this.load.spritesheet('white_key_up', 'keys/white/white_key_up_anim.png', { frameWidth: 71, frameHeight: 124 });
    this.load.spritesheet('black_key_down', 'keys/black/black_key_down_anim.png', { frameWidth: 40, frameHeight: 62 });
    this.load.spritesheet('black_key_middle', 'keys/black/black_key_middle_anim.png', { frameWidth: 40, frameHeight: 62 });
    this.load.spritesheet('black_key_up', 'keys/black/black_key_up_anim.png', { frameWidth: 40, frameHeight: 62 });
    AUDIO_SAMPLE_ASSETS.forEach((sample) => {
      this.load.audio(sample.key, sample.path);
    });
  }

  create() {
    this.anims.create({
      key: 'currency_spin',
      frames: this.anims.generateFrameNumbers('currency', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'progress_loop',
      frames: this.anims.generateFrameNumbers('progress_anim', { start: 0, end: 7 }),
      frameRate: 8,
      repeat: -1,
    });

    [
      { animationKey: 'instrument_bg_piano', texture: 'piano_hold_bg' },
      { animationKey: 'instrument_bg_synth', texture: 'synth_hold_bg' },
      { animationKey: 'instrument_bg_organ', texture: 'organ_hold_bg' },
      { animationKey: 'instrument_bg_retro', texture: 'retro_hold_bg' },
      { animationKey: 'instrument_bg_electro', texture: 'electro_hold_bg' },
    ].forEach(({ animationKey, texture }) => {
      this.anims.create({
        key: animationKey,
        frames: this.anims.generateFrameNumbers(texture, { start: 0, end: 7 }),
        frameRate: 8,
        repeat: -1,
      });
    });

    this.anims.create({
      key: 'sustain_off',
      frames: this.anims.generateFrameNumbers('sustain', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'sustain_on',
      frames: this.anims.generateFrameNumbers('sustain', { start: 4, end: 7 }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'metronome_off',
      frames: this.anims.generateFrameNumbers('metronome', { start: 0, end: 7 }),
      frameRate: 8,
      repeat: -1,
    });

    this.anims.create({
      key: 'metronome_on',
      frames: this.anims.generateFrameNumbers('metronome', { start: 8, end: 15 }),
      frameRate: 8,
      repeat: -1,
    });

    INSTRUMENT_MINI_ASSETS.forEach(({ texture }) => {
      this.anims.create({
        key: `${texture}_active`,
        frames: this.anims.generateFrameNumbers(texture, { start: 0, end: 7 }),
        frameRate: 8,
        repeat: -1,
      });
    });

    [
      'middle_round_button_bg',
      'middle_text_button_bg',
      'small_text_button_bg',
      'small_round_button_bg',
      'middle_square_button_bg',
      'small_square_button_bg',
    ].forEach((texture) => {
      this.anims.create({
        key: `${texture}_active`,
        frames: this.anims.generateFrameNumbers(texture, { start: 0, end: 2 }),
        frameRate: 8,
        repeat: -1,
      });
    });

    [
      'middle_round_back_icon',
      'middle_round_info_icon',
      'middle_text_button_compose',
      'middle_text_button_emporium',
      'middle_text_button_listen_again',
      'middle_text_button_listen',
      'middle_text_button_records',
      'small_text_button_cancel',
      'small_text_button_leave',
      'small_text_button_ok',
      'small_round_pause_icon',
      'small_round_play_icon',
      'small_round_record_icon',
      'small_round_remove_icon',
      'small_round_replay_icon',
      'small_round_save_icon',
      'small_round_stop_icon',
      'middle_square_play_icon',
      'small_square_done_icon',
      'small_square_oct_icon',
      'small_square_remove_icon',
    ].forEach((texture) => {
      this.anims.create({
        key: `${texture}_active`,
        frames: this.anims.generateFrameNumbers(texture, { start: 0, end: 2 }),
        frameRate: 8,
        repeat: -1,
      });
    });

    this.anims.create({
      key: 'arrow_button_active',
      frames: this.anims.generateFrameNumbers('arrow_button', { start: 0, end: 7 }),
      frameRate: 8,
      repeat: -1,
    });

    ['white', 'black'].forEach((keyColor) => {
      ['down', 'middle', 'up'].forEach((tier) => {
        const texture = `${keyColor}_key_${tier}`;
        this.anims.create({
          key: `${texture}_idle`,
          frames: this.anims.generateFrameNumbers(texture, { start: 0, end: 2 }),
          frameRate: 8,
          repeat: -1,
        });
        this.anims.create({
          key: `${texture}_pressed`,
          frames: this.anims.generateFrameNumbers(texture, { start: 3, end: 5 }),
          frameRate: 10,
          repeat: -1,
        });
      });
    });

    const post = this.registry.get('post') as PostInfoResponse;
    const nextScene = !post || post.mode === AppMode.HUB ? 'MainMenu' : 'RateTrackScene';
    this.scene.start(nextScene);

    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent('HIDE_PHASER_LOADER'));
      window.dispatchEvent(new CustomEvent('HIDE_INITIAL_PHASER_LOADER'));
    }, 80);
  }
}
