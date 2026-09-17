import { ValidationError } from '@/errors/AppError';
import { validateUploadedFile } from '@/modules/memories/fileValidation';

describe('validateUploadedFile', () => {
  it('accepts a valid JPEG under the size limit', () => {
    expect(() => validateUploadedFile({ size: 1024 * 1024, mimetype: 'image/jpeg' })).not.toThrow();
  });

  it('accepts a valid PNG and WEBP', () => {
    expect(() => validateUploadedFile({ size: 1000, mimetype: 'image/png' })).not.toThrow();
    expect(() => validateUploadedFile({ size: 1000, mimetype: 'image/webp' })).not.toThrow();
  });

  it('rejects a missing file', () => {
    expect(() => validateUploadedFile(undefined)).toThrow(ValidationError);
  });

  it('rejects a file over 5MB', () => {
    expect(() => validateUploadedFile({ size: 6 * 1024 * 1024, mimetype: 'image/jpeg' })).toThrow(
      ValidationError,
    );
  });

  it('accepts a file exactly at the size limit', () => {
    expect(() =>
      validateUploadedFile({ size: 5 * 1024 * 1024, mimetype: 'image/jpeg' }),
    ).not.toThrow();
  });

  it('rejects an unsupported mime type', () => {
    expect(() => validateUploadedFile({ size: 1000, mimetype: 'application/pdf' })).toThrow(
      ValidationError,
    );
  });

  it('rejects a disguised executable (wrong mimetype for image field)', () => {
    expect(() =>
      validateUploadedFile({ size: 1000, mimetype: 'application/x-msdownload' }),
    ).toThrow(ValidationError);
  });
});
