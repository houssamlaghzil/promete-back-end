import fs from 'fs';
import path from 'path';
import sharp from 'sharp';  // For image conversions
import { fileTypeFromBuffer } from 'file-type';  // Correct named import

// Dictionary for compatible extensions
const conversionMap = {
    'image/png': ['jpg', 'jpeg', 'gif', 'bmp', 'webp'],
    'image/jpeg': ['png', 'gif', 'bmp', 'webp'],
    'image/gif': ['png', 'jpg', 'jpeg', 'bmp', 'webp'],
    // Add more file types and compatible conversions as needed
};

// Supported formats by sharp
const sharpSupportedFormats = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'tiff', 'heif'];

export default async function fileConversion(file) {
    console.log('Starting file conversion...');
    try {
        const filePath = path.resolve(file.path);
        console.log(`Resolved file path: ${filePath}`);

        const fileBuffer = await fs.promises.readFile(filePath);
        console.log('File read into buffer successfully.');

        const type = await fileTypeFromBuffer(fileBuffer);
        console.log(`Detected file type: ${type ? type.mime : 'unknown'}`);

        if (!type || !conversionMap[type.mime]) {
            console.error(`Unsupported file type for conversion: ${type ? type.mime : 'unknown'}`);
            return { error: `Unsupported file type for conversion: ${type ? type.mime : 'unknown'}` };
        }

        const compatibleExtensions = conversionMap[type.mime];
        const convertedFiles = [];
        console.log(`Starting conversions for compatible extensions: ${compatibleExtensions.join(', ')}`);

        for (const ext of compatibleExtensions) {
            const newFileName = `${file.filename}.${ext}`;
            const newFilePath = path.resolve(`uploads/${newFileName}`);
            console.log(`Converting to ${ext} format...`);

            try {
                if (sharpSupportedFormats.includes(ext)) {
                    // Perform conversion using sharp for supported formats
                    await sharp(filePath).toFormat(ext).toFile(newFilePath);
                    console.log(`Conversion to ${ext} successful.`);
                } else {
                    // Skip unsupported formats
                    console.log(`Skipping unsupported format: ${ext}`);
                    continue;  // Skip to the next iteration for unsupported formats
                }

                convertedFiles.push({ extension: ext, path: newFilePath });
            } catch (conversionError) {
                console.error(`Error converting file to ${ext}:`, conversionError.message);
                return { error: `Failed to convert file to ${ext}. Error: ${conversionError.message}` };
            }
        }

        console.log('All compatible conversions completed.');
        return { originalType: type.mime, convertedFiles };
    } catch (error) {
        console.error('Error in fileConversion:', error.message);
        return { error: `Failed to convert file. Error: ${error.message}` };
    }
}
