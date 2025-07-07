import React, { useState, useRef, useEffect } from 'react';
import { Send, Database, ExternalLink, MessageCircle, History, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';

interface DatasetResult {
  id: string;
  title: string;
  description: string;
  uri: string;
  text_match?: number;
  vector_distance?: number;
}

interface ConversationMessage {
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  results?: DatasetResult[];
}

interface TypesenseResponse {
  conversation: {
    answer: string;
    conversation_id: string;
  };
  results: Array<{
    hits: Array<{
      document: DatasetResult;
      text_match?: number;
      vector_distance?: number;
    }>;
  }>;
}

interface SavedConversation {
  id: string;
  title: string;
  timestamp: Date;
  messages: ConversationMessage[];
}

const Index = () => {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [serverUrl, setServerUrl] = useState('http://localhost:8108');
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const savedConversationId = localStorage.getItem('typesense_conversation_id');
    const savedMessages = localStorage.getItem('typesense_messages');
    const savedApiKey = localStorage.getItem('typesense_api_key');
    const savedServerUrl = localStorage.getItem('typesense_server_url');
    const savedConversationsData = localStorage.getItem('typesense_saved_conversations');
    
    if (savedConversationId) setConversationId(savedConversationId);
    if (savedMessages) setMessages(JSON.parse(savedMessages));
    if (savedApiKey) setApiKey(savedApiKey);
    if (savedServerUrl) setServerUrl(savedServerUrl);
    if (savedConversationsData) setSavedConversations(JSON.parse(savedConversationsData));
  }, []);

  useEffect(() => {
    if (conversationId) {
      localStorage.setItem('typesense_conversation_id', conversationId);
    }
    if (messages.length > 0) {
      localStorage.setItem('typesense_messages', JSON.stringify(messages));
    }
  }, [conversationId, messages]);

  useEffect(() => {
    if (apiKey) localStorage.setItem('typesense_api_key', apiKey);
  }, [apiKey]);

  useEffect(() => {
    if (serverUrl) localStorage.setItem('typesense_server_url', serverUrl);
  }, [serverUrl]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const searchDatasets = async (query: string) => {
    if (!apiKey.trim()) {
      toast({
        title: "Clé API manquante",
        description: "Veuillez saisir votre clé API Typesense",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      let conversationParams = 'conversation_model_id=conv-model-1';
      if (conversationId) {
        conversationParams += `&conversation_id=${conversationId}`;
      }
      
      const url = `${serverUrl}/multi_search?q=${encodeURIComponent(query)}&conversation=true&${conversationParams}`;
      
      console.log('URL de requête:', url);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TYPESENSE-API-KEY': apiKey,
        },
        body: JSON.stringify({
          searches: [
            {
              collection: 'datagouv',
              query_by: 'embedding',
              exclude_fields: 'embedding',
              per_page: 10,
              vector_distance_threshold: 0.8
            }
          ]
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Erreur de réponse:', errorData);
        throw new Error(`Erreur HTTP: ${response.status}`);
      }

      const data: TypesenseResponse = await response.json();
      console.log('Réponse Typesense:', data);
      
      const results: DatasetResult[] = data.results[0]?.hits
        .filter(hit => hit.vector_distance && hit.vector_distance < 0.7)
        .slice(0, 5)
        .map(hit => ({
          ...hit.document,
          text_match: hit.text_match,
          vector_distance: hit.vector_distance
        })) || [];

      if (data.conversation?.conversation_id) {
        setConversationId(data.conversation.conversation_id);
      }

      const userMessage: ConversationMessage = {
        type: 'user',
        content: query,
        timestamp: new Date()
      };

      let assistantContent = data.conversation?.answer || 'Aucune réponse disponible';
      if (results.length === 0) {
        assistantContent += '\n\nAucun jeu de données pertinent trouvé pour votre requête. Essayez de reformuler votre question ou d\'utiliser des termes différents.';
      }

      const assistantMessage: ConversationMessage = {
        type: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
        results
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);
      
    } catch (error) {
      console.error('Erreur lors de la recherche:', error);
      toast({
        title: "Erreur de recherche",
        description: "Impossible de contacter le serveur Typesense. Vérifiez votre configuration.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    
    const query = inputValue.trim();
    setInputValue('');
    await searchDatasets(query);
  };

  const saveCurrentConversation = () => {
    if (messages.length === 0) return;
    
    const firstUserMessage = messages.find(msg => msg.type === 'user');
    const title = firstUserMessage ? 
      firstUserMessage.content.substring(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '') :
      'Conversation sans titre';
    
    const newConversation: SavedConversation = {
      id: conversationId || Date.now().toString(),
      title,
      timestamp: new Date(),
      messages: [...messages]
    };
    
    const updatedConversations = [newConversation, ...savedConversations.filter(conv => conv.id !== newConversation.id)];
    setSavedConversations(updatedConversations);
    localStorage.setItem('typesense_saved_conversations', JSON.stringify(updatedConversations));
    
    toast({
      title: "Conversation sauvegardée",
      description: "Votre conversation a été ajoutée à l'historique",
    });
  };

  const loadConversation = (conversation: SavedConversation) => {
    setMessages(conversation.messages);
    setConversationId(conversation.id);
    setShowHistory(false);
    
    toast({
      title: "Conversation chargée",
      description: `Conversation "${conversation.title}" restaurée`,
    });
  };

  const deleteConversation = (conversationToDelete: SavedConversation) => {
    const updatedConversations = savedConversations.filter(conv => conv.id !== conversationToDelete.id);
    setSavedConversations(updatedConversations);
    localStorage.setItem('typesense_saved_conversations', JSON.stringify(updatedConversations));
    
    toast({
      title: "Conversation supprimée",
      description: "La conversation a été supprimée de l'historique",
    });
  };

  const clearConversation = () => {
    if (messages.length > 0) {
      saveCurrentConversation();
    }
    
    setMessages([]);
    setConversationId(null);
    localStorage.removeItem('typesense_conversation_id');
    localStorage.removeItem('typesense_messages');
    
    toast({
      title: "Nouvelle conversation",
      description: "Conversation précédente sauvegardée",
    });
  };

  const formatDescription = (description: string) => {
    return description.length > 200 ? description.substring(0, 200) + '...' : description;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Database className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              DataGouv Assistant
            </h1>
          </div>
          <p className="text-lg text-gray-600">
            Explorez les jeux de données français avec l'IA conversationnelle
          </p>
        </div>

        <Card className="mb-6 border-dashed">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Configuration Typesense
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">URL du serveur</label>
                <Input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://localhost:8108"
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Clé API</label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Votre clé API Typesense"
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <History className="h-5 w-5" />
                  Historique
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowHistory(!showHistory)}
                >
                  {showHistory ? 'Masquer' : 'Afficher'}
                </Button>
              </CardHeader>
              
              {showHistory && (
                <CardContent className="flex-1 overflow-y-auto space-y-2">
                  {savedConversations.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Aucune conversation sauvegardée</p>
                    </div>
                  ) : (
                    savedConversations.map((conversation) => (
                      <div key={conversation.id} className="group relative">
                        <Card 
                          className="p-3 hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => loadConversation(conversation)}
                        >
                          <div className="text-sm font-medium truncate mb-1">
                            {conversation.title}
                          </div>
                          <div className="text-xs text-gray-500">
                            {conversation.timestamp.toLocaleDateString()}
                          </div>
                        </Card>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conversation);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              )}
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="h-[600px] flex flex-col">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Conversation
                </CardTitle>
                <div className="flex gap-2">
                  {messages.length > 0 && (
                    <>
                      <Button variant="outline" size="sm" onClick={saveCurrentConversation}>
                        Sauvegarder
                      </Button>
                      <Button variant="outline" size="sm" onClick={clearConversation}>
                        Nouvelle conversation
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 overflow-y-auto space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Posez votre première question sur les données publiques françaises</p>
                    <p className="text-sm mt-2">Exemple: "Quels jeux de données parlent de recyclage dans les collectivités ?"</p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-3 ${
                          message.type === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                        {message.results && message.results.length > 0 && (
                          <div className="mt-2 text-xs text-gray-500">
                            {message.results.length} dataset(s) trouvé(s) (max 5)
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </CardContent>

              <Separator />
              
              <CardContent className="pt-4">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Posez votre question sur les données publiques..."
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button type="submit" disabled={isLoading || !inputValue.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Database className="h-5 w-5" />
              Datasets (Top 5)
            </h2>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {messages
                .filter(msg => msg.type === 'assistant' && msg.results)
                .slice(-1)[0]?.results?.map((result, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">
                      <a
                        href={result.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-600 transition-colors flex items-start gap-2"
                      >
                        {result.title}
                        <ExternalLink className="h-3 w-3 mt-1 flex-shrink-0" />
                      </a>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-xs leading-relaxed">
                      {formatDescription(result.description)}
                    </CardDescription>
                    {(result.text_match || result.vector_distance) && (
                      <div className="mt-2 flex gap-2">
                        {result.text_match && (
                          <Badge variant="secondary" className="text-xs">
                            Score: {result.text_match}
                          </Badge>
                        )}
                        {result.vector_distance && (
                          <Badge variant="outline" className="text-xs">
                            Distance: {result.vector_distance.toFixed(3)}
                          </Badge>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )) || (
                <div className="text-center text-gray-500 py-8">
                  <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Les résultats apparaîtront ici</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
