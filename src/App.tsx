import React, { useState, useEffect } from 'react';
import { GrantApplicationForm } from './components/GrantApplicationForm';
import { supabase } from './lib/supabase';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Verify Supabase connection
    const checkConnection = async () => {
      try {
        const { data, error } = await supabase.from('grant_applications').select('count');
        if (error) throw error;
        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to connect to database');
        setIsLoading(false);
      }
    };

    checkConnection();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-orange-500/20 rounded-full blur-3xl -z-10 transform translate-x-2/3"></div>
      <div className="absolute inset-0 bg-gradient-to-tl from-blue-500/20 to-orange-500/20 rounded-full blur-3xl -z-10 transform -translate-x-2/3"></div>
      <div className="relative max-w-4xl mx-auto">
        <GrantApplicationForm
          theme={{
            primary: 'gray',
            secondary: 'gray',
            accent: 'red'
          }}
          onSuccess={() => {
            console.log('Form submitted successfully');
          }}
        />
      </div>
    </div>
  );
}

export default App;