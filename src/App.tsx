import { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Plus, Users, ShoppingBag, DollarSign, RefreshCw, AlertCircle } from 'lucide-react';
import type { Product, Participant } from './types';
import { fetchSpreadsheetData } from './services/sheets';

function App() {
  const [products, setProducts] = useState<Product[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSpreadsheetData();
      setProducts(data.products);
      setParticipants(data.participants);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalCost = products.reduce((acc, p) => acc + p.price, 0);

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-charcoal-400 gap-4">
          <RefreshCw className="w-10 h-10 animate-spin text-ember-500" />
          <p>Loading Churrasco Data...</p>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-red-400 gap-4">
          <AlertCircle className="w-12 h-12" />
          <p className="text-xl font-semibold">Error Loading Data</p>
          <p className="text-sm bg-red-900/20 p-4 rounded-lg border border-red-500/20">{error}</p>
          <button
            onClick={loadData}
            className="px-6 py-2 bg-charcoal-800 hover:bg-charcoal-700 rounded-lg text-white transition-colors"
          >
            Try Again
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-ember-500/10 rounded-full blur-2xl group-hover:bg-ember-500/20 transition-all" />
          <div className="p-3 bg-charcoal-800 rounded-xl">
            <DollarSign className="w-6 h-6 text-ember-400" />
          </div>
          <div>
            <p className="text-charcoal-400 text-sm font-medium">Total Cost</p>
            <p className="text-2xl font-bold text-white">R$ {totalCost.toFixed(2)}</p>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all" />
          <div className="p-3 bg-charcoal-800 rounded-xl">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-charcoal-400 text-sm font-medium">Participants</p>
            <p className="text-2xl font-bold text-white">{participants.length}</p>
          </div>
        </div>

        <div className="glass-panel p-6 rounded-2xl flex items-center gap-4 relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-500/20 transition-all" />
          <div className="p-3 bg-charcoal-800 rounded-xl">
            <ShoppingBag className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-charcoal-400 text-sm font-medium">Products</p>
            <p className="text-2xl font-bold text-white">{products.length}</p>
          </div>
        </div>
      </div>

      {/* Main Actions */}
      <div className="flex flex-wrap gap-4 mb-8">
        <button className="flex-1 md:flex-none px-6 py-3 bg-gradient-to-r from-ember-600 to-red-600 hover:from-ember-500 hover:to-red-500 text-white font-semibold rounded-xl shadow-lg shadow-ember-900/20 transition-all flex items-center justify-center gap-2 transform hover:-translate-y-0.5 active:translate-y-0">
          <Plus className="w-5 h-5" />
          Add Product
        </button>
        <button className="flex-1 md:flex-none px-6 py-3 glass-panel hover:bg-white/10 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
          <Users className="w-5 h-5" />
          Add Participant
        </button>
        <button
          onClick={loadData}
          className="flex-none px-4 py-3 glass-panel hover:bg-white/10 text-white rounded-xl transition-all flex items-center justify-center"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Participants Breakdown */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-ember-500" />
            Participants Report
          </h2>
          <div className="grid gap-4">
            {participants.length === 0 ? (
              <div className="text-charcoal-500 italic p-4">No participants found.</div>
            ) : (
              participants.map((person) => (
                <div key={person.name} className="glass-panel p-5 rounded-xl border-l-4 border-l-ember-500 hover:translate-x-1 transition-transform">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-lg">{person.name}</h3>
                    <span className="text-xl font-bold text-ember-400">R$ {person.totalToPay.toFixed(2)}</span>
                  </div>
                  <div className="space-y-1">
                    {person.productsConsumed.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm text-charcoal-400">
                        <span>{item.productName}</span>
                        <span>R$ {item.shareCost.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Products List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-400" />
            Products
          </h2>
          <div className="glass-panel rounded-xl overflow-hidden">

            {products.length === 0 ? (
              <div className="text-charcoal-500 italic p-8 text-center">No products found on sheet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-charcoal-900/50 text-charcoal-400">
                    <tr>
                      <th className="p-4 font-medium">Item</th>
                      <th className="p-4 font-medium">Value</th>
                      <th className="p-4 font-medium">Consumers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 font-medium text-white">{p.name}</td>
                        <td className="p-4 text-charcoal-300">R$ {p.price.toFixed(2)}</td>
                        <td className="p-4 text-charcoal-400">
                          <div className="flex -space-x-2 overflow-hidden">
                            {p.consumers.map((c, i) => (
                              <div key={i} className="w-6 h-6 rounded-full bg-charcoal-700 flex items-center justify-center text-[10px] border border-charcoal-800" title={c}>
                                {c.charAt(0)}
                              </div>
                            ))}
                            {p.consumers.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-charcoal-800 flex items-center justify-center text-[10px] border border-charcoal-800">
                                +{p.consumers.length}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default App;
