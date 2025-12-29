
const fs = require('fs');
const path = 'f:/Castro Brothers Dropbox/Marcos Castro/Churrasco/App Churrasco/src/services/sheets.ts';

try {
    let content = fs.readFileSync(path, 'utf8');
    const lines = content.split(/\r?\n/);

    const uniqueBadString = 'sheetId: 113213682';
    const badLineIdx = lines.findIndex(l => l.includes(uniqueBadString));

    if (badLineIdx !== -1) {
        console.log(`Found bad line at index ${badLineIdx}`);

        let startIdx = badLineIdx;
        while (startIdx > 0 && !lines[startIdx].trim().startsWith('// Delete the found row')) {
            startIdx--;
        }

        let endIdx = badLineIdx;
        while (endIdx < lines.length && !lines[endIdx].includes('});')) {
            endIdx++;
        }

        console.log(`Removing lines ${startIdx + 1} to ${endIdx + 1}`);

        // Remove the block
        lines.splice(startIdx, endIdx - startIdx + 1);

        fs.writeFileSync(path, lines.join('\n'));
        console.log('Successfully fixed sheets.ts');
    } else {
        console.log('Unique bad string not found. File might be already fixed.');
    }
} catch (e) {
    console.error('Error fixing file:', e);
}
