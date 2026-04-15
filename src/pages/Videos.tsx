import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Bookmark, BookmarkCheck, ExternalLink, Loader2 } from 'lucide-react';
import { EmptyState, emptyStateConfig } from '@/components/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import type { VideoSearchResult, SavedVideo } from '@/lib/types';

export default function Videos() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VideoSearchResult[]>([]);
  const [savedVideos, setSavedVideos] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoSearchResult | null>(null);
  const [savingVideo, setSavingVideo] = useState<string | null>(null);
  const { toast } = useToast();

  // Load saved videos on mount
  useEffect(() => {
    if (!user) return;

    const loadSavedVideos = async () => {
      const { data } = await supabase
        .from('saved_videos')
        .select('youtube_video_id')
        .eq('user_id', user.id);

      if (data) {
        setSavedVideos(new Set(data.map((v: { youtube_video_id: string }) => v.youtube_video_id)));
      }
    };

    loadSavedVideos();
  }, [user]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Not authenticated', description: 'Please log in to search videos.', variant: 'destructive' });
        setSearching(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/youtube-search?q=${encodeURIComponent(query.trim())}&maxResults=12`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to search videos');
      }

      const data = await response.json();
      setResults(data.videos || []);

      if (data.videos?.length === 0) {
        toast({ title: 'No results', description: 'Try a different search term.' });
      }
    } catch (error) {
      console.error('Video search error:', error);
      toast({
        title: 'Search failed',
        description: error instanceof Error ? error.message : 'Failed to search videos',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  const handleSaveVideo = async (video: VideoSearchResult) => {
    if (!user) {
      toast({ title: 'Not authenticated', description: 'Please log in to save videos.', variant: 'destructive' });
      return;
    }

    const isAlreadySaved = savedVideos.has(video.videoId);
    setSavingVideo(video.videoId);

    try {
      if (isAlreadySaved) {
        // Remove from saved
        const { error } = await supabase
          .from('saved_videos')
          .delete()
          .eq('user_id', user.id)
          .eq('youtube_video_id', video.videoId);

        if (error) throw error;

        setSavedVideos((prev) => {
          const next = new Set(prev);
          next.delete(video.videoId);
          return next;
        });
        toast({ title: 'Video removed from saved' });
      } else {
        // Save video
        const { error } = await supabase.from('saved_videos').insert({
          user_id: user.id,
          youtube_video_id: video.videoId,
          title: video.title,
          channel_title: video.channelName,
          thumbnail_url: video.thumbnail,
        });

        if (error) throw error;

        setSavedVideos((prev) => new Set([...prev, video.videoId]));
        toast({ title: 'Video saved!' });
      }
    } catch (error) {
      console.error('Save video error:', error);
      toast({
        title: 'Save failed',
        description: error instanceof Error ? error.message : 'Failed to save video',
        variant: 'destructive',
      });
    } finally {
      setSavingVideo(null);
    }
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
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
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
                  onClick={() => handleSaveVideo(selectedVideo)}
                  disabled={savingVideo === selectedVideo.videoId}
                >
                  {savingVideo === selectedVideo.videoId ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : savedVideos.has(selectedVideo.videoId) ? (
                    <BookmarkCheck className="h-4 w-4 mr-2" />
                  ) : (
                    <Bookmark className="h-4 w-4 mr-2" />
                  )}
                  {savedVideos.has(selectedVideo.videoId) ? 'Saved' : 'Save'}
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
