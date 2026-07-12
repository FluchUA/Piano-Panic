import { InstrumentId, ShopItem } from '../../shared/api';

export type InstrumentMiniAsset = {
    texture: string;
    path: string;
};

export const INSTRUMENT_MINI_ASSETS: InstrumentMiniAsset[] = [
    { texture: 'mini_piano_hold_bg', path: 'mini/mini_piano_hold_bg.png' },
    { texture: 'mini_synth_hold_bg', path: 'mini/mini_synth_hold_bg.png' },
    { texture: 'mini_organ_hold_bg', path: 'mini/mini_organ_hold_bg.png' },
    { texture: 'mini_retro_hold_bg', path: 'mini/mini_retro_hold_bg.png' },
    { texture: 'mini_electro_hold_bg', path: 'mini/mini_electro_hold_bg.png' },
];

const INSTRUMENT_MINI_TEXTURES: Record<InstrumentId, string> = {
    [InstrumentId.DEFAULT_PIANO]: 'mini_piano_hold_bg',
    [InstrumentId.SYNTH_PIANO]: 'mini_synth_hold_bg',
    [InstrumentId.ORGAN]: 'mini_organ_hold_bg',
    [InstrumentId.RETRO]: 'mini_retro_hold_bg',
    [InstrumentId.ELECTRO]: 'mini_electro_hold_bg',
};

const SHOP_ITEM_MINI_TEXTURES: Record<ShopItem, string | null> = {
    [ShopItem.TIME_PLUS_5]: 'mini_clock',
    [ShopItem.SYNTH_PIANO]: 'mini_synth_hold_bg',
    [ShopItem.ORGAN]: 'mini_organ_hold_bg',
    [ShopItem.RETRO]: 'mini_retro_hold_bg',
    [ShopItem.ELECTRO]: 'mini_electro_hold_bg',
};

export const getInstrumentMiniTexture = (instrument: InstrumentId) => INSTRUMENT_MINI_TEXTURES[instrument];

export const getShopItemMiniTexture = (item: ShopItem) => SHOP_ITEM_MINI_TEXTURES[item];
