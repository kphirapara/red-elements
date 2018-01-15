import {
  Nodes
} from '../'

import {
  Context
} from '../../../context'

import {
  Link
} from '../../interfaces'

const { log } = console

export interface ILinkManager {
  removeLink(l: Link)
  addLink(link: Link)
}

export class LinkManager extends Context {
  constructor(public nodes: Nodes) {
    super()
  }

  /**
   * Remove a link
   * @param link {string} link to remove
   */
  removeLink(link: Link) {
    const { links } = this.nodes

    var index = links.indexOf(link);
    if (index != -1) {
      links.splice(index, 1);
    }
    return this.nodes
  }

  /**
   * Add a link
   * @param link {string} link to add
   */
  addLink(link: Link) {
    const { links } = this.nodes
    this._validateLink(link, 'link', 'addLink')
    links.push(link);

    return this.nodes
  }
}
