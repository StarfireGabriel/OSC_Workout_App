import fs from 'fs';
import path from 'path';

const read = (file) => fs.readFileSync(path.join(__dirname, file), 'utf8');
const css = read('index.css').replace(/\/\*[\s\S]*?\*\//g, '');

function readBlock(selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = css.match(new RegExp(`(?:^|})\\s*${escaped}\\s*\\{([^}]*)\\}`));
    const variables = {};
    const declaration = /(--[\w-]+)\s*:\s*([^;]+);/g;
    let item;
    while (found && (item = declaration.exec(found[1]))) variables[item[1]] = item[2].trim();
    return variables;
}

// dark is :root, the others override it (colorblind only changes some variables)
const root = readBlock(':root');
const themes = {
    dark: root,
    light: { ...root, ...readBlock('[data-theme="light"]') },
    colorblind: { ...root, ...readBlock('[data-theme="colorblind"]') }
};
const THEME_NAMES = Object.keys(themes);

function colorsIn(value) {
    return (value.match(/#[0-9a-f]{3,6}\b/gi) || []).map((hex) => {
        let digits = hex.slice(1);
        if (digits.length === 3) digits = digits.split('').map((c) => c + c).join('');
        return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16) / 255);
    });
}

const one = (value) => {
    const colors = colorsIn(value);
    if (colors.length !== 1) throw new Error(`expected one #hex color in "${value}"`);
    return colors[0];
};

const toLinear = (channel) =>
    channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);

function contrast(a, b) {
    const luminance = ([r, g, bl]) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(bl);
    const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (lighter + 0.05) / (darker + 0.05);
}

// Machado et al. 2009 matrices (full severity), applied in linear RGB. distance is in CIE Lab, bigger = easier to tell apart
const CVD_MATRIX = {
    normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    protanopia: [
        [0.152286, 1.052583, -0.204868],
        [0.114503, 0.786281, 0.099216],
        [-0.003882, -0.048116, 1.051998]
    ],
    deuteranopia: [
        [0.367322, 0.860646, -0.227968],
        [0.280085, 0.672501, 0.047413],
        [-0.01182, 0.04294, 0.968881]
    ]
};

function toLab(color, vision) {
    const linear = color.map(toLinear);
    const [r, g, b] = CVD_MATRIX[vision].map((row) =>
        Math.min(1, Math.max(0, row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2]))
    );
    const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
    const x = f((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047);
    const y = f(0.2126729 * r + 0.7151522 * g + 0.072175 * b);
    const z = f((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function colorDistance(hexA, hexB, vision) {
    const a = toLab(one(hexA), vision);
    const b = toLab(one(hexB), vision);
    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

test('index.css defines the dark, light and colorblind themes', () => {
    THEME_NAMES.forEach((name) => expect(themes[name]['--accent-1']).toBeDefined());
    expect(readBlock('[data-theme="light"]')['--bg']).toBeDefined();
    expect(readBlock('[data-theme="colorblind"]')['--accent-3']).toBeDefined();
});

describe.each(THEME_NAMES)('%s theme', (name) => {
    const theme = themes[name];
    const backgrounds = [...colorsIn(theme['--bg-base']), ...colorsIn(theme['--bg'])];

    test.each(['--text', '--text-heading', '--text-soft'])(
        '%s is readable on the whole page background (WCAG AA, 4.5:1)',
        (variable) => {
            backgrounds.forEach((background) => {
                expect(contrast(one(theme[variable]), background)).toBeGreaterThanOrEqual(4.5);
            });
        }
    );

    test('the selected theme button (--on-accent on --accent-1) is readable', () => {
        expect(contrast(one(theme['--on-accent']), one(theme['--accent-1']))).toBeGreaterThanOrEqual(4.5);
    });
});

// dark is the original look (white label, 2.6:1 and 3.8:1) and is left as it was, so only the other themes are checked
describe.each(['light', 'colorblind'])('%s theme button label', (name) => {
    test.each(['--accent-1', '--accent-2'])('is readable on the button gradient end %s', (end) => {
        expect(contrast(one(themes[name]['--button-text']), one(themes[name][end]))).toBeGreaterThanOrEqual(4.5);
    });
});

test('button labels use --button-text, not a hard-coded white', () => {
    expect(read('Pages/Home.css')).not.toMatch(/color:\s*#fff/i);
});

describe('colorblind theme accents', () => {
    const theme = themes.colorblind;
    const pairs = [
        ['--accent-1', '--accent-2'],
        ['--accent-1', '--accent-3'],
        ['--accent-2', '--accent-3']
    ];

    test.each(['normal', 'protanopia', 'deuteranopia'])('stay easy to tell apart with %s', (vision) => {
        pairs.forEach(([first, second]) => {
            expect(colorDistance(theme[first], theme[second], vision)).toBeGreaterThanOrEqual(40);
        });
    });

    test.each(['--accent-1', '--accent-2', '--accent-3'])('%s is visible against the page (3:1 for graphics)', (variable) => {
        expect(contrast(one(theme[variable]), one(theme['--bg-base']))).toBeGreaterThanOrEqual(3);
    });

    test('the original red and green are NOT easy to tell apart with deuteranopia', () => {
        expect(colorDistance(themes.dark['--accent-2'], themes.dark['--accent-3'], 'normal')).toBeGreaterThan(100);
        expect(colorDistance(themes.dark['--accent-2'], themes.dark['--accent-3'], 'deuteranopia')).toBeLessThan(40);
    });

    test('orange and yellow (the first colorblind palette) are NOT easy to tell apart either', () => {
        expect(colorDistance('#e69f00', '#f0e442', 'deuteranopia')).toBeLessThan(40);
        expect(colorDistance('#e69f00', '#f0e442', 'protanopia')).toBeLessThan(40);
    });
});
