"use client";

import { type PropsWithChildren, useEffect, useRef, useState, type FC } from "react";
import { Database, FileUp, XIcon, PlusIcon, FileText } from "lucide-react";
import {
  AttachmentPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  useAuiState,
  useAui,
} from "@assistant-ui/react";
import { useShallow } from "zustand/shallow";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type ComposerDatasetOption = {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
};

const useFileSrc = (file: File | undefined) => {
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!file) {
      setSrc(undefined);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSrc(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [file]);

  return src;
};

const useAttachmentSrc = () => {
  const { file, src } = useAuiState(
    useShallow((s): { file?: File; src?: string } => {
      if (s.attachment.type !== "image") return {};
      if (s.attachment.file) return { file: s.attachment.file };
      const src = s.attachment.content?.filter((c) => c.type === "image")[0]
        ?.image;
      if (!src) return {};
      return { src };
    }),
  );

  return useFileSrc(file) ?? src;
};

type AttachmentPreviewProps = {
  src: string;
};

const AttachmentPreview: FC<AttachmentPreviewProps> = ({ src }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  return (
    <img
      src={src}
      alt="Attachment preview"
      className={cn(
        "block h-auto max-h-[80vh] w-auto max-w-full object-contain",
        isLoaded
          ? "aui-attachment-preview-image-loaded"
          : "aui-attachment-preview-image-loading invisible",
      )}
      onLoad={() => setIsLoaded(true)}
    />
  );
};

const AttachmentPreviewDialog: FC<PropsWithChildren> = ({ children }) => {
  const src = useAttachmentSrc();

  if (!src) return children;

  return (
    <Dialog>
      <DialogTrigger
        className="aui-attachment-preview-trigger cursor-pointer transition-colors hover:bg-accent/50"
        asChild
      >
        {children}
      </DialogTrigger>
      <DialogContent className="aui-attachment-preview-dialog-content p-2 sm:max-w-3xl [&>button]:rounded-full [&>button]:bg-foreground/60 [&>button]:p-1 [&>button]:opacity-100 [&>button]:ring-0! [&_svg]:text-background [&>button]:hover:[&_svg]:text-destructive">
        <DialogTitle className="aui-sr-only sr-only">
          Image Attachment Preview
        </DialogTitle>
        <div className="aui-attachment-preview relative mx-auto flex max-h-[80dvh] w-full items-center justify-center overflow-hidden bg-background">
          <AttachmentPreview src={src} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

const AttachmentThumb: FC = () => {
  const src = useAttachmentSrc();

  return (
    <Avatar className="aui-attachment-tile-avatar h-full w-full rounded-none">
      <AvatarImage
        src={src}
        alt="Attachment preview"
        className="aui-attachment-tile-image object-cover"
      />
      <AvatarFallback>
        <FileText className="aui-attachment-tile-fallback-icon size-8 text-muted-foreground" />
      </AvatarFallback>
    </Avatar>
  );
};

const AttachmentUI: FC = () => {
  const aui = useAui();
  const isComposer = aui.attachment.source !== "message";

  const isImage = useAuiState((s) => s.attachment.type === "image");
  const typeLabel = useAuiState((s) => {
    const type = s.attachment.type;
    switch (type) {
      case "image":
        return "Image";
      case "document":
        return "Document";
      case "file":
        return "File";
      default:
        return type;
    }
  });

  return (
    <Tooltip>
      <AttachmentPrimitive.Root
        className={cn(
          "aui-attachment-root relative",
          isImage && "aui-attachment-root-composer only:*:first:size-24",
        )}
      >
        <AttachmentPreviewDialog>
          <TooltipTrigger asChild>
            <div
              className="aui-attachment-tile size-14 cursor-pointer overflow-hidden rounded-[calc(var(--composer-radius)-var(--composer-padding))] border bg-muted transition-opacity hover:opacity-75"
              role="button"
              tabIndex={0}
              aria-label={`${typeLabel} attachment`}
            >
              <AttachmentThumb />
            </div>
          </TooltipTrigger>
        </AttachmentPreviewDialog>
        {isComposer && <AttachmentRemove />}
      </AttachmentPrimitive.Root>
      <TooltipContent side="top">
        <AttachmentPrimitive.Name />
      </TooltipContent>
    </Tooltip>
  );
};

const AttachmentRemove: FC = () => {
  return (
    <AttachmentPrimitive.Remove asChild>
      <TooltipIconButton
        tooltip="Remove file"
        className="aui-attachment-tile-remove absolute top-1.5 right-1.5 size-3.5 rounded-full bg-white text-muted-foreground opacity-100 shadow-sm hover:bg-white! [&_svg]:text-black hover:[&_svg]:text-destructive"
        side="top"
      >
        <XIcon className="aui-attachment-remove-icon size-3 dark:stroke-[2.5px]" />
      </TooltipIconButton>
    </AttachmentPrimitive.Remove>
  );
};

export const UserMessageAttachments: FC = () => {
  return (
    <div className="aui-user-message-attachments-end col-span-full col-start-1 row-start-1 flex w-full flex-row justify-end gap-2">
      <MessagePrimitive.Attachments>
        {() => <AttachmentUI />}
      </MessagePrimitive.Attachments>
    </div>
  );
};

export const ComposerAttachments: FC = () => {
  return (
    <div className="aui-composer-attachments flex w-full flex-row items-center gap-2 overflow-x-auto empty:hidden">
      <ComposerPrimitive.Attachments>
        {() => <AttachmentUI />}
      </ComposerPrimitive.Attachments>
    </div>
  );
};

function insertDatasetReference(dataset: ComposerDatasetOption) {
  const input = document.querySelector<HTMLTextAreaElement>(".aui-composer-input");
  if (!input) return;

  const reference = `Use dataset ${dataset.name} (${dataset.id}). `;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const prefix = start > 0 && !/\s$/u.test(input.value.slice(0, start)) ? " " : "";
  input.setRangeText(`${prefix}${reference}`, start, end, "end");
  input.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: reference }));
  input.focus();
}

export const ComposerAddAttachment: FC<{
  datasets?: ComposerDatasetOption[];
}> = ({ datasets = [] }) => {
  const visibleDatasets = datasets.slice(0, 12);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const aui = useAui();

  const openFilePicker = () => {
    const input = fileInputRef.current;
    if (!input) return;
    const attachmentAccept = aui.composer().getState().attachmentAccept;
    input.accept = attachmentAccept === "*" ? "" : attachmentAccept;
    input.value = "";
    input.click();
  };

  const handleFilesSelected = async (files: FileList | null) => {
    if (!files) return;
    await Promise.all(Array.from(files).map((file) => aui.composer().addAttachment(file)));
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          void handleFilesSelected(event.currentTarget.files);
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TooltipIconButton
            tooltip="Add"
            side="bottom"
            variant="ghost"
            size="icon"
            className="aui-composer-add-attachment size-8 rounded-full p-1 font-semibold text-xs hover:bg-muted-foreground/15 dark:border-muted-foreground/15 dark:hover:bg-muted-foreground/30"
            aria-label="Add"
          >
            <PlusIcon className="aui-attachment-add-icon size-5 stroke-[1.5px]" />
          </TooltipIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-72 rounded-2xl p-2">
          <DropdownMenuItem
            className="rounded-xl px-3 py-3 text-base font-normal normal-case tracking-normal"
            onSelect={openFilePicker}
          >
            <FileUp className="size-5" />
            Add photos & files
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="rounded-xl px-3 py-3 text-base font-normal normal-case tracking-normal">
              <Database className="size-5" />
              Datasets
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-80 rounded-2xl p-2">
              <DropdownMenuLabel className="px-3 py-2 text-base font-normal tracking-normal text-muted-foreground normal-case">
                {datasets.length} available datasets
              </DropdownMenuLabel>
              {visibleDatasets.length > 0 ? (
                visibleDatasets.map((dataset) => (
                  <DropdownMenuItem
                    key={dataset.id}
                    className="rounded-xl px-3 py-3 text-base font-normal normal-case tracking-normal"
                    onSelect={() => insertDatasetReference(dataset)}
                  >
                    <Database className="size-5" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{dataset.name}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {dataset.description || dataset.id}
                      </span>
                    </span>
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem
                  disabled
                  className="rounded-xl px-3 py-3 text-base font-normal normal-case tracking-normal"
                >
                  No datasets yet
                </DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
