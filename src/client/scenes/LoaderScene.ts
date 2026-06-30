import { Scene } from 'phaser';
import { LoaderOverlay } from '../UI/LoaderOverlay';

export class LoaderScene extends Scene {
    constructor() {
        super('LoaderScene');
    }

    create() {
        new LoaderOverlay(this);
    }
}
