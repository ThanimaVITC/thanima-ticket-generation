// Self-check for the food colour email builder. Pure string work, no database, no SMTP.
// Run: pnpm check:food-email
import assert from 'node:assert/strict';
import {
    buildFoodColorEmailHtml,
    withFoodEmailDefaults,
    DEFAULT_FOOD_EMAIL_TEMPLATE,
    COLOR_BOX_TOKEN,
} from '../src/lib/email-templates';

const vars = {
    name: 'Aravind K',
    regNo: '22BCS118',
    eventTitle: 'Thanima 2026',
    date: '16 August 2026',
    color: 'Red',
    timing: '1:00 PM – 2:00 PM',
};

const render = (t: Partial<typeof DEFAULT_FOOD_EMAIL_TEMPLATE>, v = vars) =>
    buildFoodColorEmailHtml({ template: t, variables: v, colorName: 'Red', colorHex: '#EF4444' });

// --- the colour box appears where the token is, and carries the name in words ---
const full = render(DEFAULT_FOOD_EMAIL_TEMPLATE);
assert.ok(full.includes('bgcolor="#EF4444"'), 'swatch needs the bgcolor attribute for Outlook');
assert.ok(full.includes('background-color: #EF4444'), 'swatch needs the inline style too');
assert.ok(full.includes('RED'), 'colour name must be in words, not colour alone');
assert.ok(!full.includes(COLOR_BOX_TOKEN), 'token must be consumed, never mailed literally');

// --- no token means no box (and the author is warned in the UI) ---
const noBox = render({ ...DEFAULT_FOOD_EMAIL_TEMPLATE, body: 'Hi {{name}}, you are in.' });
assert.ok(!noBox.includes('bgcolor='), 'no token, no box');
assert.ok(noBox.includes('Aravind K'), 'placeholders still resolve');

// --- a line referencing empty {{timing}} is dropped whole ---
const noTiming = render(DEFAULT_FOOD_EMAIL_TEMPLATE, { ...vars, timing: '' });
assert.ok(!noTiming.includes('Your sitting is at'), 'timing line must vanish when unset');
assert.ok(noTiming.includes('Red counter'), 'other lines survive');
assert.ok(render(DEFAULT_FOOD_EMAIL_TEMPLATE).includes('1:00 PM – 2:00 PM'), 'timing shows when set');

// --- a blank non-optional variable must NOT delete its line ---
const blankReg = render({ ...DEFAULT_FOOD_EMAIL_TEMPLATE, body: 'Reg: {{regNo}} end' }, { ...vars, regNo: '' });
assert.ok(blankReg.includes('Reg:'), 'only listed optional vars may drop a line');

// --- blank heading/footer drop their sections rather than rendering empty chrome ---
const bare = render({ ...DEFAULT_FOOD_EMAIL_TEMPLATE, heading: '', footer: '' });
assert.ok(!bare.includes('<h2'), 'blank heading drops the bar');
assert.ok(!bare.includes('border-top: 1px solid #eeeeee'), 'blank footer drops the rule');

// --- author text is escaped, so a stray angle bracket cannot break the markup ---
const nasty = render({ ...DEFAULT_FOOD_EMAIL_TEMPLATE, body: 'a <script>x</script> b' });
assert.ok(!nasty.includes('<script>'), 'template text must be escaped');
assert.ok(nasty.includes('&lt;script&gt;'), 'escaped, not stripped');

// --- ink flips for legibility on light vs dark swatches ---
const onYellow = buildFoodColorEmailHtml({
    template: DEFAULT_FOOD_EMAIL_TEMPLATE, variables: vars, colorName: 'Yellow', colorHex: '#EAB308',
});
assert.ok(onYellow.includes('#1a1a1a'), 'dark ink on a light swatch');
const onNavy = buildFoodColorEmailHtml({
    template: DEFAULT_FOOD_EMAIL_TEMPLATE, variables: vars, colorName: 'Navy', colorHex: '#1E3A8A',
});
assert.ok(onNavy.includes('#ffffff'), 'light ink on a dark swatch');

// --- defaults fill in for a template saved before these fields existed ---
const legacy = withFoodEmailDefaults({ subject: 'Old', body: 'Old body' });
assert.equal(legacy.subject, 'Old');
assert.equal(legacy.heading, DEFAULT_FOOD_EMAIL_TEMPLATE.heading);
assert.equal(legacy.footer, DEFAULT_FOOD_EMAIL_TEMPLATE.footer);

console.log('food email template: all checks passed');
