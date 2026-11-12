-- Add JS-rendered crawl provenance for evidence excerpts.
ALTER TYPE "ExtractionMethod" ADD VALUE IF NOT EXISTS 'RENDERED_JS';
