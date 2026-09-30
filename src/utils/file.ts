export function downloadAsFile(filename: string, content: string, contentType: string = 'application/json') {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function openFileAndRead(accept: string = '.json'): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    
    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        resolve(event.target?.result as string);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

export function openFilesAndRead(accept: string = '.json'): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = true;
    input.style.display = 'none';
    
    input.onchange = async (e: any) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) {
        reject(new Error('No file selected'));
        return;
      }
      
      const readPromises = files.map((file: any) => {
        return new Promise<string>((res, rej) => {
          const reader = new FileReader();
          reader.onload = (event) => res(event.target?.result as string);
          reader.onerror = (error) => rej(error);
          reader.readAsText(file);
        });
      });
      
      try {
        const contents = await Promise.all(readPromises);
        resolve(contents);
      } catch (err) {
        reject(err);
      }
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}

export function openFilesWithNames(accept: string = '.json,.yaml,.yml'): Promise<{name: string, content: string}[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = true;
    input.style.display = 'none';
    
    input.onchange = async (e: any) => {
      const files = Array.from(e.target.files || []);
      if (files.length === 0) {
        reject(new Error('No file selected'));
        return;
      }
      
      const readPromises = files.map((file: any) => {
        return new Promise<{name: string, content: string}>((res, rej) => {
          const reader = new FileReader();
          reader.onload = (event) => res({ name: file.name, content: event.target?.result as string });
          reader.onerror = (error) => rej(error);
          reader.readAsText(file);
        });
      });
      
      try {
        const results = await Promise.all(readPromises);
        resolve(results);
      } catch (err) {
        reject(err);
      }
    };
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  });
}
