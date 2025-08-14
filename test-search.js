const YouTube = require('youtube-sr').default;

async function testSearch() {
  try {
    console.log('Testing YouTube search...\n');
    
    const queries = ['hello', 'never gonna give you up', 'test song'];
    
    for (const query of queries) {
      console.log(`Searching for: "${query}"`);
      try {
        const results = await YouTube.search(query, { limit: 5, type: 'video' });
        console.log(`Found ${results.length} results`);
        
        if (results.length > 0) {
          const choices = results.map(video => ({
            name: video.title && video.title.length > 100 ? video.title.substring(0, 97) + '...' : (video.title || 'Unknown'),
            value: video.url,
          }));
          console.log('First result:', choices[0]);
        }
      } catch (error) {
        console.error(`Error searching for "${query}":`, error.message);
      }
      console.log('');
    }
  } catch (error) {
    console.error('Test error:', error);
  }
}

testSearch();