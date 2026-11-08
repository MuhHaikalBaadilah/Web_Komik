/**
 * WordPressMangastream - Base class for manga sites built on WordPress
 * Provides common functionality for scraping manga from WordPress-based sites
 */
export default class WordPressMangastream {
    constructor() {
        // Base URL for the WordPress site
        this.url = '';
        // Path pattern for manga listings, %PAGE% is replaced with page number
        this.path = '/page/%PAGE%/';
        // Selector for manga entries on listing pages
        this.queryMangas = 'article a';
        // Selector for chapter links
        this.queryChapters = 'div.chapter-list a';
        // Selector for page images
        this.queryPages = 'div.reader img';
        // Title selector from URI
        this.querMangaTitleFromURI = 'h1.entry-title';
        // Chapters title from page (optional)
        this.queryChaptersTitle = undefined;
        // Tags for this source
        this.tags = [];
    }

    /**
     * Check if the URI can be handled by this provider
     * @param {URL} uri - The URL to check
     * @returns {boolean} - Whether this provider can handle the URI
     */
    canHandleURI(uri) {
        return true;
    }

    /**
     * Get the list of manga from the site
     * @async
     * @returns {Promise<Array>} Array of manga objects with id and title
     */
    async _getMangas() {
        let mangaList = [];
        for (let page = 1, run = true; run; page++) {
            const path = page > 1 ? this.path : '/';
            let mangas = await this._getMangasFromPage(path, page);
            mangas.length ? mangaList.push(...mangas) : run = false;
        }
        return mangaList;
    }

    /**
     * Get manga list from a specific page
     * @async
     * @param {string} path - The page path (with %PAGE% placeholder replaced)
     * @param {number} page - The page number
     * @returns {Promise<Array>} Array of manga objects
     */
    async _getMangasFromPage(path, page) {
        const uri = new URL(path.replace('%PAGE%', page), this.url);
        const request = new Request(uri, this.requestOptions);
        const data = await this.fetchDOM(request, this.queryMangas);
        return data.map(element => {
            return {
                id: this.getRootRelativeOrAbsoluteLink(element, this.url),
                title: element.title.trim()
            };
        });
    }

    /**
     * Get the chapter list for a manga
     * @async
     * @param {object} manga - The manga object
     * @returns {Promise<Array>} Array of chapter objects with id and title
     */
    async _getChapters(manga) {
        // Default implementation - can be overridden
        throw new Error('_getChapters not implemented');
    }

    /**
     * Get the page images for a chapter
     * @async
     * @param {object} chapter - The chapter object with id property
     * @returns {Promise<Array>} Array of page image URLs
     */
    async _getPages(chapter) {
        // Default implementation - can be overridden
        throw new Error('_getPages not implemented');
    }

    /**
     * Handle a connector URI (for loading images through a proxy/referer)
     * @async
     * @param {string} payload - The URI to fetch
     * @returns {Promise<Blob>} The response blob
     */
    async _handleConnectorURI(payload) {
        let request = new Request(payload, this.requestOptions);
        request.headers.set('x-referer', this.url);
        let response = await fetch(request);
        let data = await response.blob();
        data = await this._blobToBuffer(data);
        this._applyRealMime(data);
        return data;
    }

    /**
     * Fetch DOM elements from a URL
     * @param {Request} request - The request object
     * @param {string} selector - The CSS selector to match
     * @returns {Promise<Array>} Array of DOM elements
     */
    async fetchDOM(request, selector) {
        // This should be implemented by the subclass or framework
        throw new Error('fetchDOM not implemented');
    }

    /**
     * Get the root relative or absolute link from an element
     * @param {object} element - The DOM element
     * @param {string} baseUrl - The base URL to resolve against
     * @returns {string} The absolute URL
     */
    getRootRelativeOrAbsoluteLink(element, baseUrl) {
        const link = element.href || element.getAttribute('href') || '';
        if (link.startsWith('http')) {
            return link;
        }
        return new URL(link, baseUrl).href;
    }

    /**
     * Convert a blob to buffer
     * @param {Blob} data - The blob to convert
     * @returns {Promise<ArrayBuffer>} The buffer
     * @protected
     */
    async _blobToBuffer(data) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsArrayBuffer(data);
        });
    }

    /**
     * Apply the real MIME type to data
     * @param {ArrayBuffer} data - The data buffer
     * @protected
     */
    _applyRealMime(data) {
        // Can be overridden by subclasses
    }
}