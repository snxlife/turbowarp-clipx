// @ts-ignore
import source from '../i18n/source.json'
import { clean } from './utils'
import Cache from './cache'
import type Option from './option'
import { commonjs } from "./env"

export default class Extension {
  protected option: Option;
  protected blocks: object[];
  protected menus: Record<string, { items: any[] }>;
  protected cache: Cache;

  public constructor(option: Option) {
    this.option = option;
    this.cache = new Cache(option.uptime, option.debug);
    this.blocks = [];
    this.menus = {};

    if (commonjs) {
      // @ts-ignore
      import('../i18n/generate').then((module) => {
        module.process_i18n(option.blocks, option.i18n || {}).then(() => 0);
      });
      return;
    }

    // @ts-ignore
    Scratch.translate.setup(source);
    for (const block of option.blocks) {
      const cache = block.cache;
      if (cache?.enable) {
        this.cache.register(block.opcode, cache.expiration || 0);
        block.bind = this.cache.cache(block.opcode, block.bind);
      }  /** @ts-expect-error */
      this[block.opcode] = block.bind;
      if ((block.menu != null) && (Object.keys(Object(block.menu)).length > 0)) {
        for (const name in block.menu) this.menus[name] = { items: block.menu[name] };
      }

      const res: RegExpMatchArray | null = block.text.match(/\[\S*:\S*]/ig);
      const args: Record<string, Record<string, any>> = {};
      res?.map((arg: string): void => {
        const [variable, type]: string[] = arg.slice(1, -1).split(':');
        block.text = block.text.replace(arg, `[${variable}]`);
        args[variable] = clean({ // @ts-expect-error
          type: Scratch.ArgumentType[type.toUpperCase()],
          defaultValue: (block.default != null) ? block.default[variable] : undefined,
          menu: ((block.menu != null) && block.menu[variable]) ? variable : undefined,
        });
      });

      this.blocks.push(clean({
        opcode: block.opcode,
        blockType: block.blockType,  // @ts-ignore
        text: Scratch.translate({
          id: block.opcode,
          default: block.text,
        }),
        arguments: args,
        disableMonitor: block.disableMonitor,
      }));
    }
  }

  // @ts-expect-error
  public getInfo(): Scratch.Info {
    return clean({
      id: this.option.id,
      name: this.option.name,
      color1: this.option.color1,
      color2: this.option.color2,
      color3: this.option.color3,
      menuIconURI: this.option.menuIconURI,
      blockIconURI: this.option.blockIconURI,
      docsURI: this.option.docsURI,
      blocks: this.blocks,
      menus: this.menus,
    })
  }

  public register() {
    if (commonjs) return;
    try {
      // @ts-expect-error
      Scratch.extensions.register(this);
    } catch (e) {
      console.info(`Failed to load extension ${this.option.name}`);
      if (this.option.debug) console.error(e);
    }
  }
}
