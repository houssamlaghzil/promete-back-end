import fs from 'fs';
import path from 'path';
import { fileTypeFromBuffer } from 'file-type';  // Correct named import

// Dictionary for compatible extensions
const conversionMap = {
    'image/png': ['jpg', 'jpeg', 'gif', 'bmp', 'webp'],
    'image/jpeg': ['png', 'gif', 'bmp', 'webp'],
    'image/gif': ['png', 'jpg', 'jpeg', 'bmp', 'webp'],
    // Add more file types and compatible conversions as needed
};

export default async function fileTypeDetection(file) {
    console.log('Starting file type detection...');
    try {
        const filePath = path.resolve(file.path);
        console.log(`Resolved file path: ${filePath}`);

        const fileBuffer = await fs.promises.readFile(filePath);
        console.log('File read into buffer successfully.');

        const type = await fileTypeFromBuffer(fileBuffer);
        console.log(`Detected file type: ${type ? type.mime : 'unknown'}`);

        if (!type || !conversionMap[type.mime]) {
            console.error(`Unsupported file type: ${type ? type.mime : 'unknown'}`);
            return { error: `Unsupported file type: ${type ? type.mime : 'unknown'}` };
        }

        console.log(`Compatible extensions for ${type.mime}: ${conversionMap[type.mime].join(', ')}`);
        return { originalType: type.mime, compatibleExtensions: conversionMap[type.mime] };
    } catch (error) {
        console.error('Error in fileTypeDetection:', error.message);
        return { error: `Failed to detect file type. Error: ${error.message}` };
    }
}
