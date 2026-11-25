import { describe, expect, it } from 'vitest';
import { buildShareTargetUrl, SHARE_POST_TEXT } from '../matchShare';

describe('buildShareTargetUrl', () => {
    it('prefills the X post with encoded text', () => {
        const url = new URL(buildShareTargetUrl('x'));
        expect(url.origin).toBe('https://x.com');
        expect(url.pathname).toBe('/intent/tweet');
        expect(url.searchParams.get('text')).toBe(SHARE_POST_TEXT);
        expect(buildShareTargetUrl('x', 'a&b #c')).toBe('https://x.com/intent/tweet?text=a%26b%20%23c');
    });

    it('opens the Facebook feed (no public URL to pass to the sharer yet)', () => {
        expect(buildShareTargetUrl('facebook')).toBe('https://www.facebook.com/');
    });

    it('post text is hashtags only, so it needs no translation', () => {
        expect(SHARE_POST_TEXT.split(' ').every((w) => w.startsWith('#'))).toBe(true);
    });
});
