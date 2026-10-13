const assert = require('node:assert/strict');
const { test } = require('node:test');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(relativePath, dependencies) {
    const source = readFileSync(resolve(__dirname, '..', relativePath), 'utf8');
    const { outputText } = ts.transpileModule(source, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    });
    const exports = {};
    vm.runInNewContext(outputText, {
        exports,
        require: (name) => {
            if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
            return dependencies[name];
        },
    });
    return exports;
}

test('tag refresh preserves chart, but changed candles and executions update it', () => {
    const chart = load('components/market-chart.tsx', {
        react: { memo: (component, compare) => ({ compare }) },
        'react/jsx-runtime': {},
        'lightweight-charts': {},
    }).default;
    const before = {
        data: [{ time: 1, open: 10, high: 12, low: 9, close: 11 }],
        trades: [{ time: 1, side: 'B', price: 10 }],
    };
    const copy = () => JSON.parse(JSON.stringify(before));
    assert.equal(chart.compare(before, copy()), true);
    for (const key of ['time', 'open', 'high', 'low', 'close']) {
        const after = copy();
        after.data[0][key]++;
        assert.equal(chart.compare(before, after), false, key);
    }
    for (const key of ['time', 'side', 'price']) {
        const after = copy();
        after.trades[0][key] = key === 'side' ? 'S' : 2;
        assert.equal(chart.compare(before, after), false, key);
    }
    assert.equal(chart.compare(before, { ...copy(), trades: [] }), false);
});

