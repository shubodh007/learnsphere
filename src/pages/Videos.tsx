import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Bookmark, ExternalLink } from 'lucide-react';
import { EmptyState, emptyStateConfig } from '@/components/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { VideoSearchResult } from '@/lib/types';

export default function Videos() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VideoSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoSearchResult | null>(null);
  const { toast } = useToast();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    // TODO: call youtube-search edge function
    toast({
      title: 'Backend not connected',
      description: 'Enable Lovable Cloud to search YouTube videos.',
      variant: 'destructive',
    });
    setSearching(false);
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Video Tutorials</h1>
        <p className="text-muted-foreground mt-1">Search and save the best learning videos</p>
      </motion.div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for tutorials..."
            className="pl-10"
          />
        </div>
        <Button type="submit" disabled={searching} className="gradient-bg border-0">
          Search
        </Button>
      </form>

      {/* Results */}
      {results.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((video) => (
            <Card
              key={video.videoId}
              className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer overflow-hidden"
              onClick={() => setSelectedVideo(video)}
            >
              <img
                src={video.thumbnail}
                alt={video.title}
                className="w-full aspect-video object-cover"
                loading="lazy"
              />
              <CardContent className="p-4">
                <h3 className="font-medium text-foreground text-sm line-clamp-2 mb-1">{video.title}</h3>
                <p className="text-xs text-muted-foreground">{video.channelName}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState {...emptyStateConfig.videos} />
      )}

      {/* Video Player Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="line-clamp-1">{selectedVideo?.title}</DialogTitle>
          </DialogHeader>
          {selectedVideo && (
            <div className="space-y-4">
              <div className="aspect-video w-full">
                <iframe
                  src={`https://www.youtube.com/embed/${selectedVideo.videoId}`}
                  className="w-full h-full rounded-lg"
                  allowFullScreen
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toast({ title: 'Backend not connected', description: 'Enable Lovable Cloud to save videos.', variant: 'destructive' });
                  }}
                >
                  <Bookmark className="h-4 w-4 mr-2" /> Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`https://www.youtube.com/watch?v=${selectedVideo.videoId}`, '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" /> Open on YouTube
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
